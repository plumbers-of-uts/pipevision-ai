/**
 * image-dropzone.tsx — Drag-and-drop / click upload zone for the Detect page.
 * Matches gui-mockup.html .upload-zone structure.
 * Accepts image files only (jpg, png, bmp, tiff). Max 10 MB.
 * Calls onFileAccepted with the accepted File object.
 */

"use client";

import { CloudUpload } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/bmp", "image/tiff", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

interface ImageDropzoneProps {
  onFileAccepted: (file: File) => void;
}

export function ImageDropzone({ onFileAccepted }: ImageDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(file: File): string | null {
    if (
      !ACCEPTED_TYPES.includes(file.type) &&
      !file.name.match(/\.(jpg|jpeg|png|bmp|tiff?|webp)$/i)
    ) {
      return "Unsupported file type. Please use JPG, PNG, BMP, or TIFF.";
    }
    if (file.size > MAX_BYTES) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`;
    }
    return null;
  }

  function handleFile(file: File) {
    const err = validate(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onFileAccepted(file);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onClick() {
    inputRef.current?.click();
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  }

  return (
    <div>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Upload pipe inspection image"
        onChange={onInputChange}
      />

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop pipe inspection image here or click to browse"
        className={cn(
          "relative cursor-pointer rounded-lg border-2 border-dashed px-10 py-16 text-center transition-all duration-200",
          "bg-bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
          dragging
            ? "border-accent bg-accent-muted"
            : "border-border-hover hover:border-accent hover:bg-accent-muted",
        )}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <CloudUpload
          className="mx-auto mb-4 size-12 text-fg-tertiary"
          aria-hidden={true}
          strokeWidth={1.5}
        />
        <div className="mb-1.5 text-base font-semibold text-fg-primary">
          Drop pipe inspection image here or click to browse
        </div>
        <div className="text-xs leading-relaxed text-fg-tertiary">
          Drag &amp; drop or click to select a file
          <br />
          CCTV footage &middot; Lateral camera &middot; Push-rod inspection
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {["JPG", "PNG", "BMP", "TIFF", "Max 10MB"].map((tag) => (
            <span
              key={tag}
              className="rounded border border-border-hover bg-bg-elevated px-2 py-0.5 font-mono text-[10px] font-semibold text-fg-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
