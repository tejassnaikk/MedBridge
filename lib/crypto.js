import crypto from 'crypto';

const ALGO = 'aes-256-cbc';
const KEY = Buffer.from(
  process.env.PHONE_ENCRYPTION_KEY || 'a'.repeat(64),
  'hex'
);

export function encryptPhone(phone) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = cipher.update(phone, 'utf8', 'hex') + cipher.final('hex');
  return `${iv.toString('hex')}:${enc}`;
}

export function decryptPhone(stored) {
  const [ivHex, encHex] = stored.split(':');
  const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivHex, 'hex'));
  return decipher.update(encHex, 'hex', 'utf8') + decipher.final('utf8');
}
