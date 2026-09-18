// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * A minimal PNG reader and writer, 8-bit RGBA and nothing else.
 *
 * This exists so `preview.ts` can render a map to an image on a machine with
 * no native toolchain. `sharp` and `canvas` both want a compiler and a stack
 * of prebuilt binaries; on a Raspberry Pi that is the difference between
 * `pnpm install` working and not. Node already ships zlib, and the subset of
 * PNG we actually need — colour type 6, bit depth 8, no interlacing — is
 * about a hundred lines.
 *
 * Both tilesheets we read are exactly that subset. `decode` throws rather
 * than guessing if it ever meets something else, because a silently
 * misdecoded tilesheet looks like a map-generator bug and wastes an
 * afternoon.
 */

import { deflateSync, inflateSync, crc32 } from 'node:zlib';

export interface Image {
  readonly width: number;
  readonly height: number;
  /** Row-major RGBA, 4 bytes per pixel, straight (not premultiplied) alpha. */
  readonly px: Buffer;
}

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Undo one scanline's filter, in place. PNG filter types 0-4. */
function unfilter(
  filter: number,
  line: Buffer,
  out: Buffer,
  prev: Buffer | null,
  stride: number,
): void {
  for (let x = 0; x < stride; x++) {
    const a = x >= 4 ? out[x - 4] : 0;
    const b = prev ? prev[x] : 0;
    const c = prev && x >= 4 ? prev[x - 4] : 0;
    let v = line[x];
    switch (filter) {
      case 0:
        break;
      case 1:
        v += a;
        break;
      case 2:
        v += b;
        break;
      case 3:
        v += (a + b) >> 1;
        break;
      case 4: {
        // Paeth: pick whichever neighbour the linear predictor lands nearest.
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        break;
      }
      default:
        throw new Error(`unknown PNG filter ${filter}`);
    }
    out[x] = v & 0xff;
  }
}

export function decode(file: Buffer): Image {
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const depth = file[24];
  const colour = file[25];
  const interlace = file[28];
  if (depth !== 8 || colour !== 6 || interlace !== 0) {
    throw new Error(
      `unsupported PNG (depth ${depth}, colour type ${colour}, interlace ${interlace}); want 8-bit RGBA, non-interlaced`,
    );
  }

  const idat: Buffer[] = [];
  let o = 8;
  while (o < file.length) {
    const len = file.readUInt32BE(o);
    const type = file.toString('ascii', o + 4, o + 8);
    if (type === 'IDAT') idat.push(file.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));

  const stride = width * 4;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const at = y * (stride + 1);
    const out = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    unfilter(raw[at], raw.subarray(at + 1, at + 1 + stride), out, prev, stride);
  }
  return { width, height, px };
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

export function encode(img: Image): Buffer {
  const stride = img.width * 4;
  // Filter type 0 on every row. Tilemaps are large flat colour fields, so
  // deflate does the real work and per-row filtering buys almost nothing.
  const raw = Buffer.alloc(img.height * (stride + 1));
  for (let y = 0; y < img.height; y++) {
    img.px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function blank(
  width: number,
  height: number,
  rgba: readonly number[],
): Image {
  const px = Buffer.alloc(width * height * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = rgba[0];
    px[i + 1] = rgba[1];
    px[i + 2] = rgba[2];
    px[i + 3] = rgba[3];
  }
  return { width, height, px };
}

/**
 * Source-over blit of a `sw` x `sh` rect, nearest-neighbour scaled.
 *
 * Nearest-neighbour is the point, not a shortcut: smoothing a 16 px tile up
 * to preview size turns pixel art into mush.
 */
export function blit(
  dst: Image,
  src: Image,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  scale: number,
): void {
  for (let y = 0; y < sh * scale; y++) {
    const oy = dy + y;
    if (oy < 0 || oy >= dst.height) continue;
    const iy = sy + Math.floor(y / scale);
    if (iy < 0 || iy >= src.height) continue;
    for (let x = 0; x < sw * scale; x++) {
      const ox = dx + x;
      if (ox < 0 || ox >= dst.width) continue;
      const ix = sx + Math.floor(x / scale);
      if (ix < 0 || ix >= src.width) continue;
      const si = (iy * src.width + ix) * 4;
      const a = src.px[si + 3] / 255;
      if (a === 0) continue;
      const di = (oy * dst.width + ox) * 4;
      for (let c = 0; c < 3; c++) {
        dst.px[di + c] = Math.round(
          src.px[si + c] * a + dst.px[di + c] * (1 - a),
        );
      }
      dst.px[di + 3] = Math.max(dst.px[di + 3], src.px[si + 3]);
    }
  }
}
