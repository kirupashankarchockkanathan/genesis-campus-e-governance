import { LIMITS } from '@gcc/shared';
import { toDb } from '../../db/helpers.js';
import { clock } from '../../lib/clock.js';
import { AppError, errors } from '../../lib/errors.js';
import { newId, randomToken } from '../../lib/ids.js';

/** Detects the real image type from the file signature, never from the name or the declared type. */
export function detectImageType(buf) {
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'image/webp';
  return null;
}

/** Stores an image and returns its path under the API (`/api/v1/files/:id`). */
export async function saveImage(db, buffer) {
  if (buffer.length > LIMITS.POSTER_MAX_BYTES)
    throw new AppError('PAYLOAD_TOO_LARGE', 'The file is larger than 5 MB.');
  const mime = detectImageType(buffer);
  if (!mime) throw new AppError('UNSUPPORTED_FILE', 'Only PNG, JPG or WebP images are allowed.');
  const id = `${newId().replace(/-/g, '').slice(0, 12)}${randomToken(12)}`;
  await db('gov_files').insert({
    id,
    mime,
    data: buffer.toString('base64'),
    size: buffer.length,
    created_at: toDb(clock.now()),
  });
  return `/api/v1/files/${id}`;
}

export async function readImage(db, id) {
  const row = await db('gov_files').where({ id }).first();
  if (!row) throw errors.notFound('File not found.');
  return { mime: row.mime, buffer: Buffer.from(row.data, 'base64') };
}
