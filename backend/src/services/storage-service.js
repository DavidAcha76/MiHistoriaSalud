import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { randomId } from '../utils/security.js';
import { HttpError } from '../utils/http-error.js';

const extensionsByMime = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
};
// Tipos declarados que se aceptan cuando el contenido real es uno de los permitidos.
const genericDeclaredTypes = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

function safeExt(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  return ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '';
}

/** RNF-07 / PS-07: identifica el tipo real por la firma binaria, sin confiar en lo que declara el cliente. */
export function detectFileType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

export function validateFile(file) {
  if (!file) throw new HttpError(400, 'Debes seleccionar un archivo.');
  if (!file.size || !file.buffer?.length) throw new HttpError(400, 'El archivo está vacío.');
  const detected = detectFileType(file.buffer);
  if (!detected) throw new HttpError(400, 'Solo se permiten PDF, JPG, PNG o WEBP.');
  const declared = String(file.mimetype || '').toLowerCase().replace('image/jpg', 'image/jpeg');
  if (!genericDeclaredTypes.has(declared) && declared !== detected) {
    throw new HttpError(400, 'El contenido del archivo no coincide con el tipo declarado.');
  }
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext && !extensionsByMime[detected].includes(ext)) {
    throw new HttpError(400, 'La extensión del archivo no coincide con su contenido.');
  }
  return { mimeType: detected, sha256: crypto.createHash('sha256').update(file.buffer).digest('hex') };
}

const s3 = env.storage.driver === 's3'
  ? new S3Client({
      region: env.storage.s3.region,
      endpoint: env.storage.s3.endpoint,
      forcePathStyle: env.storage.s3.forcePathStyle,
      credentials: env.storage.s3.accessKeyId
        ? { accessKeyId: env.storage.s3.accessKeyId, secretAccessKey: env.storage.s3.secretAccessKey }
        : undefined
    })
  : null;

export async function savePrivateFile(file, profileId) {
  const { mimeType, sha256 } = validateFile(file);
  const key = `${profileId}/${randomId()}${safeExt(file.originalname) || extensionsByMime[mimeType][0]}`;
  if (env.storage.driver === 'database') {
    // The caller persists this buffer in clinical_documents in the same
    // database that identifies the account and profile. There is no second
    // filesystem or object-storage copy for newly uploaded documents.
    return { driver: 'database', key, content: file.buffer, mimeType, sha256 };
  }
  if (env.storage.driver === 's3') {
    if (!env.storage.s3.bucket) throw new HttpError(500, 'S3_BUCKET no está configurado.');
    await s3.send(new PutObjectCommand({
      Bucket: env.storage.s3.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: mimeType,
      ServerSideEncryption: 'AES256'
    }));
    return { driver: 's3', key, mimeType, sha256 };
  }

  const target = path.join(env.storage.localDir, key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, file.buffer, { mode: 0o600 });
  return { driver: 'local', key, mimeType, sha256 };
}

export async function openPrivateFile(driver, key, content = null) {
  if (driver === 'database') {
    if (!content) throw new HttpError(404, 'Archivo físico no encontrado.');
    return { stream: Readable.from(Buffer.from(content)) };
  }
  if (driver === 's3') {
    const result = await s3.send(new GetObjectCommand({ Bucket: env.storage.s3.bucket, Key: key }));
    return { stream: result.Body };
  }
  const target = path.join(env.storage.localDir, key);
  if (!fsSync.existsSync(target)) throw new HttpError(404, 'Archivo físico no encontrado.');
  return { stream: fsSync.createReadStream(target) };
}

export async function deletePrivateFile(driver, key) {
  if (driver === 'database') return;
  if (driver === 's3') {
    await s3.send(new DeleteObjectCommand({ Bucket: env.storage.s3.bucket, Key: key }));
    return;
  }
  const target = path.join(env.storage.localDir, key);
  await fs.rm(target, { force: true });
}
