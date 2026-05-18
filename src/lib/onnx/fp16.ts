/**
 * fp16.ts — IEEE 754 half-precision <-> single-precision conversion.
 *
 * onnxruntime-web represents fp16 tensors with a Uint16Array of the raw bits;
 * we convert by hand instead of relying on `Float16Array`, which is only
 * available in very recent browsers.
 */

const f32buf = new Float32Array(1);
const u32view = new Uint32Array(f32buf.buffer);

function float32BitsToFloat16Bits(value: number): number {
  f32buf[0] = value;
  const x = u32view[0] ?? 0;
  const sign = (x >>> 16) & 0x8000;
  let mantissa = x & 0x007fffff;
  let exp = (x >>> 23) & 0xff;

  if (exp === 0xff) {
    // Inf or NaN — preserve the sign and signal NaN with a non-zero mantissa.
    return sign | 0x7c00 | (mantissa !== 0 ? 0x200 : 0);
  }

  exp = exp - 127 + 15;
  if (exp >= 31) return sign | 0x7c00; // overflow → +/-Inf
  if (exp <= 0) {
    if (exp < -10) return sign; // underflow → +/-0
    mantissa |= 0x00800000;
    let bits = mantissa >> (1 - exp);
    if ((mantissa >> -exp) & 1) bits += 1; // round-to-nearest
    return sign | bits;
  }

  // Round mantissa to 10 bits (nearest-even).
  if (mantissa & 0x00001000) {
    mantissa += 0x00002000;
    if (mantissa & 0x00800000) {
      mantissa = 0;
      exp += 1;
      if (exp >= 31) return sign | 0x7c00;
    }
  }
  return sign | (exp << 10) | (mantissa >> 13);
}

function float16BitsToFloat32(bits: number): number {
  const sign = (bits & 0x8000) << 16;
  const exp = (bits & 0x7c00) >> 10;
  const mant = bits & 0x03ff;

  let f32: number;
  if (exp === 0) {
    if (mant === 0) {
      f32 = sign;
    } else {
      // Subnormal: normalize.
      let m = mant;
      let e = 1;
      while ((m & 0x0400) === 0) {
        m <<= 1;
        e -= 1;
      }
      m &= 0x03ff;
      f32 = sign | ((e + 127 - 15) << 23) | (m << 13);
    }
  } else if (exp === 0x1f) {
    f32 = sign | 0x7f800000 | (mant << 13);
  } else {
    f32 = sign | ((exp + 127 - 15) << 23) | (mant << 13);
  }

  u32view[0] = f32 >>> 0;
  return f32buf[0] ?? 0;
}

export function float32ToFloat16Array(src: Float32Array): Uint16Array {
  const out = new Uint16Array(src.length);
  for (let i = 0; i < src.length; i++) {
    out[i] = float32BitsToFloat16Bits(src[i] ?? 0);
  }
  return out;
}

export function float16ToFloat32Array(src: Uint16Array): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    out[i] = float16BitsToFloat32(src[i] ?? 0);
  }
  return out;
}
