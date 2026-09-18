import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { randomId } from '../utils/security.js';
import { HttpError } from '../utils/http-error.js';

const allowedMime = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function safeExt(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  return ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '';
}

function validateFile(file) {
  if (!file) throw new HttpError(400, 'Debes seleccionar un archivo.');
  if (!allowedMime.has(file.mimetype)) throw new HttpError(400, 'Solo se permiten PDF, JPG, PNG o WEBP.');
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
  validateFile(file);
  const key = `${profileId}/${randomId()}${safeExt(file.originalname)}`;
  if (env.storage.driver === 'database') {
    // The caller persists this buffer in clinical_documents in the same
    // database that identifies the account and profile. There is no second
    // filesystem or object-storage copy for newly uploaded documents.
    return { driver: 'database', key, content: file.buffer };
  }
  if (env.storage.driver === 's3') {
    if (!env.storage.s3.bucket) throw new HttpError(500, 'S3_BUCKET no está configurado.');
    await s3.send(new PutObjectCommand({
      Bucket: env.storage.s3.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ServerSideEncryption: 'AES256'
    }));
    return { driver: 's3', key };
  }

  const target = path.join(env.storage.localDir, key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, file.buffer, { mode: 0o600 });
  return { driver: 'local', key };
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
