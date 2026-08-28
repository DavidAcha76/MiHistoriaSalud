import crypto from 'node:crypto';

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const randomId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
