import fs from 'node:fs';
import path from 'node:path';
import { LIMITS } from '@ccp/shared';
import { config } from '../config/index.js';
import { AppError } from './errors.js';
import { randomToken } from './ids.js';

export const uploadDir = () => path.resolve(config.apiRoot, config.UPLOAD_DIR);

/** Detects the real file type from its signature, never from the name (spec 11.5). */
export function detectFileType(buf) {
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return { ext: 'png', mime: 'image/png' };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return { ext: 'jpg', mime: 'image/jpeg' };
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return { ext: 'webp', mime: 'image/webp' };
  if (buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-')
    return { ext: 'pdf', mime: 'application/pdf' };
  return null;
}

/** Stores an upload under a random name and returns its public URL path. */
export async function saveUpload(buffer, { imagesOnly = false } = {}) {
  if (buffer.length > LIMITS.POSTER_MAX_BYTES)
    throw new AppError('PAYLOAD_TOO_LARGE', 'The file is larger than 5 MB.');
  const type = detectFileType(buffer);
  if (!type || (imagesOnly && type.ext === 'pdf')) {
    throw new AppError('UNSUPPORTED_FILE', 'Only PNG, JPG, WebP images or PDF files are allowed.');
  }
  const name = `${randomToken(18)}.${type.ext}`;
  await fs.promises.mkdir(uploadDir(), { recursive: true });
  await fs.promises.writeFile(path.join(uploadDir(), name), buffer);
  return `/uploads/${name}`;
}
