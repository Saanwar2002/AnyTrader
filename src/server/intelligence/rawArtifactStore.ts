/**
 * AnyTrader V8.1 — Tier B Durable Raw Artifact Persistence (Admin SDK only).
 * 
 * Fail-closed: any write/read failure throws; never returns a manifest for a missing object.
 * Guarantees zero uncompressed raw AI/model output in Firestore.
 */

import zlib from 'zlib';
import { computeSha256 } from './provenance';
import { StorageManifest } from './types';

export interface RawArtifactBucketLike {
  file(path: string): {
    save(data: Buffer, opts?: Record<string, unknown>): Promise<void>;
    download(): Promise<[Buffer]>;
    exists(): Promise<[boolean]>;
  };
}

export class RawArtifactPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RawArtifactPersistenceError';
  }
}

export class RawArtifactIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RawArtifactIntegrityError';
  }
}

let globalRawArtifactBucket: RawArtifactBucketLike | null = null;

export function setGlobalRawArtifactBucket(b: RawArtifactBucketLike | null): void {
  globalRawArtifactBucket = b;
}

export function getGlobalRawArtifactBucket(): RawArtifactBucketLike | null {
  return globalRawArtifactBucket;
}

function requireBucket(bucket?: RawArtifactBucketLike | null): RawArtifactBucketLike {
  const b = bucket !== undefined && bucket !== null ? bucket : globalRawArtifactBucket;
  if (!b) {
    throw new RawArtifactPersistenceError(
      '[TierB] No raw artifact bucket configured. Refusing to emit a manifest (fail-closed).'
    );
  }
  return b;
}

/**
 * Durably uploads the gzip buffer to Firebase Storage. Returns the manifest only on confirmed write.
 * Fails closed if write fails.
 */
export async function persistRawArtifact(options: {
  compressedBuffer: Buffer;
  manifest: StorageManifest;
  bucket?: RawArtifactBucketLike | null;
}): Promise<StorageManifest> {
  const { compressedBuffer, manifest } = options;
  const b = requireBucket(options.bucket);

  if (!manifest.storagePath.startsWith('intelligence_raw/')) {
    throw new RawArtifactPersistenceError(`[TierB] Illegal storage path: ${manifest.storagePath}`);
  }

  try {
    await b.file(manifest.storagePath).save(compressedBuffer, {
      contentType: 'application/json',
      metadata: {
        contentEncoding: 'gzip',
        metadata: {
          sha256: manifest.sha256,
          schemaVersion: manifest.schemaVersion,
          originalBytes: String(manifest.originalBytes),
          compressedBytes: String(manifest.compressedBytes),
        },
      },
      resumable: false,
    });
  } catch (err) {
    throw new RawArtifactPersistenceError(
      `[TierB] Durable persistence failed for ${manifest.storagePath}: ${(err as Error).message}`
    );
  }

  return manifest;
}

/**
 * Downloads the stored artifact from Firebase Storage, decompresses it, and verifies SHA-256 integrity.
 * Throws RawArtifactIntegrityError on SHA-256 mismatch.
 */
export async function readRawArtifact(
  manifest: StorageManifest,
  bucket?: RawArtifactBucketLike | null
): Promise<Buffer> {
  const b = requireBucket(bucket);
  let buf: Buffer;

  try {
    const [downloaded] = await b.file(manifest.storagePath).download();
    buf = downloaded;
  } catch (err) {
    throw new RawArtifactPersistenceError(
      `[TierB] Download failed for ${manifest.storagePath}: ${(err as Error).message}`
    );
  }

  const decompressed = manifest.encoding === 'gzip' ? zlib.gunzipSync(buf) : buf;
  const actual = computeSha256(decompressed);

  if (actual !== manifest.sha256) {
    throw new RawArtifactIntegrityError(
      `[TierB Integrity] SHA-256 mismatch for ${manifest.storagePath}: expected ${manifest.sha256}, got ${actual}`
    );
  }

  return decompressed;
}

/**
 * Verifies that the raw artifact exists in Firebase Storage and passes SHA-256 checksum integrity.
 */
export async function verifyRawArtifact(
  manifest: StorageManifest,
  bucket?: RawArtifactBucketLike | null
): Promise<boolean> {
  await readRawArtifact(manifest, bucket);
  return true;
}
