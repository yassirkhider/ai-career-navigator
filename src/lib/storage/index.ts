import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Storage abstraction (Spec section 32/37). The rest of the app only talks
 * to this interface. LocalFileStorage below is the dev/single-instance
 * implementation; swap in an S3StorageProvider (using @aws-sdk/client-s3
 * against S3 or any S3-compatible endpoint like R2/MinIO) for production by
 * implementing the same interface — no caller changes needed.
 */
export interface StorageProvider {
  save(buffer: Buffer, opts: { originalFilename: string; mimeType: string }): Promise<{
    storedFilename: string;
    storagePath: string;
  }>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".txt"]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateUpload(file: { name: string; type: string; size: number }): string | null {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return "Unsupported file type. Please upload a PDF, DOCX, or TXT file.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "File is too large. Maximum size is 10MB.";
  }
  if (file.size === 0) {
    return "File is empty.";
  }
  const allowedMimes = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ]);
  if (!allowedMimes.has(file.type)) {
    return "File content type does not match an accepted CV format.";
  }
  return null;
}

export class LocalFileStorage implements StorageProvider {
  constructor(private readonly baseDir: string) {}

  async save(
    buffer: Buffer,
    opts: { originalFilename: string; mimeType: string }
  ): Promise<{ storedFilename: string; storagePath: string }> {
    await fs.mkdir(this.baseDir, { recursive: true });
    const ext = path.extname(opts.originalFilename).toLowerCase();
    // Randomized server-side filename — never trust the client-provided name for storage.
    const storedFilename = `${randomBytes(16).toString("hex")}${ext}`;
    const storagePath = path.join(this.baseDir, storedFilename);
    await fs.writeFile(storagePath, buffer, { mode: 0o600 });
    return { storedFilename, storagePath };
  }

  async read(storagePath: string): Promise<Buffer> {
    return fs.readFile(storagePath);
  }

  async delete(storagePath: string): Promise<void> {
    await fs.rm(storagePath, { force: true });
  }
}

let cachedStorage: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!cachedStorage) {
    const base = process.env.STORAGE_LOCAL_PATH || "./storage/uploads";
    const resolved = base.startsWith("/")
      ? base
      : path.join(process.cwd(), /* turbopackIgnore: true */ base);
    cachedStorage = new LocalFileStorage(resolved);
  }
  return cachedStorage;
}
