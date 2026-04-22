import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateDeviceCode(): string {
  const bytes = randomBytes(9);
  const chars = Array.from(bytes).map((b) => CHARSET[b % CHARSET.length]);
  return `${chars.slice(0, 3).join("")}-${chars.slice(3, 6).join("")}-${chars.slice(6, 9).join("")}`;
}

function deriveKey(code: string): Buffer {
  const secret = process.env.DEVICE_CODE_ENCRYPTION_SECRET;
  if (!secret) throw new Error("DEVICE_CODE_ENCRYPTION_SECRET is not set");
  return createHash("sha256").update(code + secret).digest();
}

export function encryptToken(plaintext: string, code: string): string {
  const key = deriveKey(code);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

export function decryptToken(encrypted: string, code: string): string {
  const key = deriveKey(code);
  const buf = Buffer.from(encrypted, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(-16);
  const ct = buf.subarray(12, -16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
