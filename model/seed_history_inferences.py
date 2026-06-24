#!/usr/bin/env python3
"""seed_history_inferences.py — Offline ONNX inference to (re)generate the
FlowBust sample gallery + Inspection History seed manifest.

This mirrors the browser inference pipeline 1:1 so the static demo data looks
identical to live, in-browser predictions:

  preprocess (letterbox 640, grey 114, RGB/255, NCHW)
    → ORT session.run (fp16 in, fp32 detections, fp16 prototypes)
    → decode NMS-included output  [1, 100, 6 + 32]  (xyxy, conf, cls, coeffs)
    → unletterbox to original pixel space
    → class-wise NMS (IoU 0.45, max 100)
    → mask decode (sigmoid(coeffs·proto) ≥ 0.5, crop in 160-grid, bilinear resize)
    → RGBA mask PNG (255 inside / 0 outside) data URL

Outputs:
  public/samples/<slug>.jpg            one clean representative frame per class
  public/seed-history/<slug>.jpg       balanced demo frames (gallery picks excluded)
  public/seed-history/inferences.json  manifest consumed by src/features/history-store/seed.ts

Run (from repo root):
  uv run --with onnxruntime --with pillow --with numpy --no-project \
      model/seed_history_inferences.py \
      --images /tmp/pv_newdata/test/images \
      --single /tmp/pv_single.txt
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import math
import os
import shutil
import time
from collections import defaultdict

import numpy as np
import onnxruntime as ort
from PIL import Image

# ── Class metadata — MUST match data.yaml order and src/.../classes.ts ──────────
CLASS_NAMES = ["Deformation", "Obstacle", "Rupture", "Disconnect", "Misalignment", "Deposition"]
NUM_CLASSES = len(CLASS_NAMES)
GALLERY_SLUGS = ["deformation", "obstacle", "rupture", "disconnect", "misalignment", "deposition"]

INPUT_SIZE = 640
CONF_THRESHOLD = 0.25
IOU_THRESHOLD = 0.45
MAX_DETECTIONS = 100
MASK_THRESHOLD = 0.5
MODEL_VERSION = "yolo26m-seg-pipevision-fp16"


# ── Preprocess ─────────────────────────────────────────────────────────────────
def letterbox(img: Image.Image, size: int = INPUT_SIZE):
    bW, bH = img.size
    scale = min(size / bW, size / bH)
    scaledW, scaledH = round(bW * scale), round(bH * scale)
    padX = (size - scaledW) / 2.0
    padY = (size - scaledH) / 2.0
    canvas = Image.new("RGB", (size, size), (114, 114, 114))
    resized = img.convert("RGB").resize((scaledW, scaledH), Image.BILINEAR)
    canvas.paste(resized, (round(padX), round(padY)))
    arr = np.asarray(canvas, dtype=np.float32) / 255.0  # HWC RGB
    tensor = np.transpose(arr, (2, 0, 1))[None]  # NCHW
    return tensor, scale, padX, padY, bW, bH


# ── Decode NMS-included output ───────────────────────────────────────────────────
def decode_and_unletterbox(out0, scale, padX, padY, bW, bH, size=INPUT_SIZE):
    rows = out0[0]  # (100, 38)
    dets = []
    for r in rows:
        x1, y1, x2, y2, conf, cls = (float(r[0]), float(r[1]), float(r[2]), float(r[3]),
                                     float(r[4]), float(r[5]))
        if not math.isfinite(conf) or conf < CONF_THRESHOLD:
            continue
        cxN = (x1 + x2) / 2.0 / size
        cyN = (y1 + y2) / 2.0 / size
        wN = (x2 - x1) / size
        hN = (y2 - y1) / size
        if wN <= 0 or hN <= 0:
            continue
        # unletterbox → original pixel space (matches unletterboxBoxes)
        cx640, cy640, w640, h640 = cxN * size, cyN * size, wN * size, hN * size
        cxOrig = (cx640 - padX) / scale
        cyOrig = (cy640 - padY) / scale
        wOrig, hOrig = w640 / scale, h640 / scale
        x = max(0, round(cxOrig - wOrig / 2))
        y = max(0, round(cyOrig - hOrig / 2))
        bw = min(round(wOrig), bW - x)
        bh = min(round(hOrig), bH - y)
        if bw <= 0 or bh <= 0:
            continue
        dets.append({
            "classId": max(0, round(cls)),
            "score": conf,
            "bbox": {"x": x, "y": y, "w": bw, "h": bh},
            "bbox640Norm": {"x": cxN, "y": cyN, "w": wN, "h": hN},
            "coeffs": r[6:6 + 32].astype(np.float32),
        })
    return dets


def iou(a, b):
    ax2, ay2 = a["x"] + a["w"], a["y"] + a["h"]
    bx2, by2 = b["x"] + b["w"], b["y"] + b["h"]
    iw = max(0, min(ax2, bx2) - max(a["x"], b["x"]))
    ih = max(0, min(ay2, by2) - max(a["y"], b["y"]))
    inter = iw * ih
    if inter == 0:
        return 0.0
    union = a["w"] * a["h"] + b["w"] * b["h"] - inter
    return inter / union if union > 0 else 0.0


def apply_nms(dets, iou_thr=IOU_THRESHOLD, max_det=MAX_DETECTIONS):
    by_class = defaultdict(list)
    for d in dets:
        by_class[d["classId"]].append(d)
    survivors = []
    for group in by_class.values():
        group.sort(key=lambda d: d["score"], reverse=True)
        suppressed = [False] * len(group)
        for i in range(len(group)):
            if suppressed[i]:
                continue
            survivors.append(group[i])
            for j in range(i + 1, len(group)):
                if not suppressed[j] and iou(group[i]["bbox"], group[j]["bbox"]) >= iou_thr:
                    suppressed[j] = True
    survivors.sort(key=lambda d: d["score"], reverse=True)
    return survivors[:max_det]


# ── Mask decode (replicates mask-decoder.ts) ────────────────────────────────────
def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def bilinear_align_corners(src, outH, outW):
    cropH, cropW = src.shape
    if outW <= 0 or outH <= 0:
        return np.zeros((max(1, outH), max(1, outW)), dtype=np.float32)
    sx = (cropW - 1) / max(1, outW - 1)
    sy = (cropH - 1) / max(1, outH - 1)
    ys = np.arange(outH) * sy
    xs = np.arange(outW) * sx
    y0 = np.floor(ys).astype(int)
    y1 = np.minimum(cropH - 1, y0 + 1)
    dy = (ys - y0)[:, None]
    x0 = np.floor(xs).astype(int)
    x1 = np.minimum(cropW - 1, x0 + 1)
    dx = (xs - x0)[None, :]
    s00 = src[np.ix_(y0, x0)]
    s10 = src[np.ix_(y0, x1)]
    s01 = src[np.ix_(y1, x0)]
    s11 = src[np.ix_(y1, x1)]
    s0 = s00 * (1 - dx) + s10 * dx
    s1 = s01 * (1 - dx) + s11 * dx
    return s0 * (1 - dy) + s1 * dy


def decode_mask(coeffs, proto, bbox640Norm, scale, padX, padY, bW, bH, size=INPUT_SIZE):
    ch, mh, mw = proto.shape  # (32, 160, 160)
    cx640 = bbox640Norm["x"] * size
    cy640 = bbox640Norm["y"] * size
    w640 = bbox640Norm["w"] * size
    h640 = bbox640Norm["h"] * size
    grid = mw / size
    x1g = max(0, math.floor((cx640 - w640 / 2) * grid))
    y1g = max(0, math.floor((cy640 - h640 / 2) * grid))
    x2g = min(mw, math.ceil((cx640 + w640 / 2) * grid))
    y2g = min(mh, math.ceil((cy640 + h640 / 2) * grid))
    cropW, cropH = x2g - x1g, y2g - y1g
    if cropW <= 0 or cropH <= 0:
        return None
    cxOrig = (cx640 - padX) / scale
    cyOrig = (cy640 - padY) / scale
    wOrig, hOrig = w640 / scale, h640 / scale
    tlx = max(0, round(cxOrig - wOrig / 2))
    tly = max(0, round(cyOrig - hOrig / 2))
    outW = max(1, min(round(wOrig), bW - tlx))
    outH = max(1, min(round(hOrig), bH - tly))
    proto_crop = proto[:, y1g:y2g, x1g:x2g]  # (32, cropH, cropW)
    scores = sigmoid(np.einsum("c,chw->hw", coeffs, proto_crop))  # (cropH, cropW)
    resized = bilinear_align_corners(scores.astype(np.float32), outH, outW)
    mask = (resized >= MASK_THRESHOLD).astype(np.uint8)
    return mask, outW, outH


def mask_to_png_dataurl(mask, w, h):
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    on = mask == 1
    rgba[on] = (255, 255, 255, 255)
    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


# ── Inference wrapper ────────────────────────────────────────────────────────────
class Model:
    def __init__(self, path):
        self.sess = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        self.inp = self.sess.get_inputs()[0]
        self.in_name = self.inp.name
        self.in_fp16 = "float16" in self.inp.type
        self.out_names = [o.name for o in self.sess.get_outputs()]

    def infer(self, img_path, with_masks=True):
        img = Image.open(img_path)
        tensor, scale, padX, padY, bW, bH = letterbox(img)
        feed = {self.in_name: tensor.astype(np.float16 if self.in_fp16 else np.float32)}
        t0 = time.perf_counter()
        out0, out1 = self.sess.run(self.out_names, feed)
        infer_ms = (time.perf_counter() - t0) * 1000.0
        dets = decode_and_unletterbox(np.asarray(out0, dtype=np.float32),
                                      scale, padX, padY, bW, bH)
        dets = apply_nms(dets)
        proto = np.asarray(out1, dtype=np.float32)[0]  # (32,160,160)
        results = []
        for d in dets:
            entry = {
                "classId": d["classId"],
                "confidence": round(d["score"], 4),
                "bbox": d["bbox"],
            }
            if with_masks:
                md = decode_mask(d["coeffs"], proto, d["bbox640Norm"],
                                 scale, padX, padY, bW, bH)
                if md is not None:
                    mask, mw, mh = md
                    if mask.any():
                        entry["maskPng"] = mask_to_png_dataurl(mask, mw, mh)
            results.append(entry)
        return results, infer_ms, bW, bH


# ── Frame selection ──────────────────────────────────────────────────────────────
def synthetic_latency(index: int, num_dets: int) -> int:
    """Deterministic, browser-realistic WebGPU inference latency (ms).

    The offline CPU `session.run` time is not representative of the in-browser
    WebGPU path (~0.4-0.6s), so the seed manifest stores a synthetic latency
    instead. Mean ~0.47s; mirrored by the JSON patch in this dir's history.
    """
    return 360 + (index * 53) % 180 + num_dets * 16


def load_single_class(path):
    """Returns {classId: [slug, ...]} from the single-class frame listing."""
    by_class = defaultdict(list)
    with open(path) as f:
        for line in f:
            parts = line.split()
            if len(parts) >= 3:
                cid = int(parts[0])
                slug = parts[2].replace(".txt", "")
                by_class[cid].append(slug)
    for cid in by_class:
        by_class[cid].sort()
    return by_class


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="model/artifacts/yolo26m-seg-fp16.onnx")
    ap.add_argument("--images", default="/tmp/pv_newdata/test/images")
    ap.add_argument("--single", default="/tmp/pv_single.txt")
    ap.add_argument("--out-samples", default="public/samples")
    ap.add_argument("--out-seed", default="public/seed-history")
    ap.add_argument("--per-class", type=int, default=14, help="seed frames per class")
    ap.add_argument("--gallery-conf", type=float, default=0.55)
    args = ap.parse_args()

    model = Model(args.model)
    by_class = load_single_class(args.single)
    print(f"[load] single-class candidates per class: "
          f"{ {CLASS_NAMES[c]: len(v) for c, v in sorted(by_class.items())} }")

    used = set()

    # ── 1. Gallery: one clean representative per class ──────────────────────────
    os.makedirs(args.out_samples, exist_ok=True)
    gallery = []
    for cid in range(NUM_CLASSES):
        cands = by_class.get(cid, [])
        best = None  # (conf, slug, dets, bW, bH)
        chosen = None
        for slug in cands[:120]:  # cap scan for speed
            p = os.path.join(args.images, f"{slug}.jpg")
            if not os.path.exists(p):
                continue
            dets, _ms, bW, bH = model.infer(p, with_masks=False)
            top = [d for d in dets if d["classId"] == cid]
            if not top:
                continue
            top_conf = max(d["confidence"] for d in top)
            # prefer: target class is the global top detection and conf high
            global_top = max(dets, key=lambda d: d["confidence"])
            if best is None or top_conf > best[0]:
                best = (top_conf, slug, dets, bW, bH)
            if (global_top["classId"] == cid and top_conf >= args.gallery_conf):
                chosen = (top_conf, slug, dets, bW, bH)
                break
        pick = chosen or best
        if pick is None:
            print(f"[gallery] WARN no candidate detected for {CLASS_NAMES[cid]}")
            continue
        conf, slug, dets, bW, bH = pick
        used.add(slug)
        src = os.path.join(args.images, f"{slug}.jpg")
        dst = os.path.join(args.out_samples, f"{GALLERY_SLUGS[cid]}.jpg")
        shutil.copyfile(src, dst)
        present = sorted({d["classId"] for d in dets})
        gallery.append({"cid": cid, "slug": GALLERY_SLUGS[cid], "src_frame": slug,
                        "conf": round(conf, 3), "present": present})
        print(f"[gallery] {CLASS_NAMES[cid]:13s} <- {slug}.jpg "
              f"conf={conf:.3f} present={present}")

    # ── 2. Seed history: balanced, gallery picks excluded ───────────────────────
    os.makedirs(args.out_seed, exist_ok=True)
    # wipe old seed jpgs (keep nothing stale); inferences.json overwritten below
    for fn in os.listdir(args.out_seed):
        if fn.endswith(".jpg"):
            os.remove(os.path.join(args.out_seed, fn))

    records = []
    for cid in range(NUM_CLASSES):
        cands = [s for s in by_class.get(cid, []) if s not in used]
        kept = 0
        for slug in cands:
            if kept >= args.per_class:
                break
            p = os.path.join(args.images, f"{slug}.jpg")
            if not os.path.exists(p):
                continue
            dets, ms, bW, bH = model.infer(p, with_masks=True)
            if not dets:
                continue
            used.add(slug)
            shutil.copyfile(p, os.path.join(args.out_seed, f"{slug}.jpg"))
            records.append({
                "slug": slug,
                "source": f"{slug}.jpg",
                "width": bW,
                "height": bH,
                "inferenceMs": 0,  # filled with a synthetic browser latency below
                "detections": dets,
            })
            kept += 1
        print(f"[seed] {CLASS_NAMES[cid]:13s} kept {kept} frames")

    # deterministic order by slug for stable timeline
    records.sort(key=lambda r: r["slug"])
    # Replace offline CPU time with a browser-realistic WebGPU latency.
    for i, r in enumerate(records):
        r["inferenceMs"] = synthetic_latency(i, len(r["detections"]))
    manifest = {
        "modelVersion": MODEL_VERSION,
        "generatedAt": 0,  # stamped deterministically; seed.ts fabricates timeline
        "conf": CONF_THRESHOLD,
        "iou": IOU_THRESHOLD,
        "records": records,
    }
    out_json = os.path.join(args.out_seed, "inferences.json")
    with open(out_json, "w") as f:
        json.dump(manifest, f, separators=(",", ":"))
    total_dets = sum(len(r["detections"]) for r in records)
    print(f"\n[done] gallery={len(gallery)} samples, seed={len(records)} frames, "
          f"{total_dets} detections -> {out_json}")
    cls_counts = defaultdict(int)
    for r in records:
        for d in r["detections"]:
            cls_counts[d["classId"]] += 1
    print("[done] seed detection class distribution: "
          f"{ {CLASS_NAMES[c]: cls_counts[c] for c in range(NUM_CLASSES)} }")


if __name__ == "__main__":
    main()
