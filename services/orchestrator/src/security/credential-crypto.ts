import { createDecipheriv, createHash } from "node:crypto";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(rawSecret: string): Buffer {
  const normalized = rawSecret.trim();
  const decoded = /^[0-9a-fA-F]+$/.test(normalized)
    ? Buffer.from(normalized, "hex")
    : Buffer.from(normalized, "base64");

  if (decoded.length === 32) {
    return decoded;
  }

  return createHash("sha256").update(normalized, "utf8").digest();
}

export function decryptStoredSecret(encryptedPayload: string, encryptionSeed: string): string {
  const [version, ivRaw, tagRaw, encryptedRaw] = encryptedPayload.split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted secret payload format.");
  }

  const key = getKey(encryptionSeed);
  const iv = Buffer.from(ivRaw, "base64");
  const authTag = Buffer.from(tagRaw, "base64");
  const encrypted = Buffer.from(encryptedRaw, "base64");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted secret payload.");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
