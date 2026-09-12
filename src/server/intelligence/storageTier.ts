/**
 * AnyTrader V8.1 — Two-Tier Storage and Compression Engine
 * 
 * Architecture:
 * - Tier A (Firestore): Lean, queryable structured intelligence (Safety budget: <= 100 KiB)
 * - Tier B (Storage): Large/raw artifacts stored gzip-compressed with sha256 manifest
 * 
 * Rules:
 * - Never base64 large binaries into Firestore.
 * - Decompression validates cryptographic SHA-256 checksum.
 */

import zlib from 'zlib';
import { computeSha256 } from './provenance';
import { StorageManifest } from './types';

export const FIRESTORE_DOC_MAX_BYTES = 100 * 1024; // 100 KiB safety budget

/**
 * Checks whether a document payload conforms to the Firestore 100 KiB safety budget
 */
export function enforceFirestoreSafetyBudget(docData: unknown, maxBytes: number = FIRESTORE_DOC_MAX_BYTES): { valid: boolean; actualBytes: number } {
  const json = typeof docData === 'string' ? docData : JSON.stringify(docData);
  const actualBytes = Buffer.byteLength(json, 'utf8');
  return {
    valid: actualBytes <= maxBytes,
    actualBytes,
  };
}

/**
 * Compresses an arbitrary raw payload or model output into gzip format for Tier B storage
 */
export function compressPayload(
  payload: Record<string, unknown> | string,
  storagePath: string,
  schemaVersion: string = 'v8.1.0'
): { compressedBuffer: Buffer; manifest: StorageManifest } {
  const rawString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const rawBuffer = Buffer.from(rawString, 'utf8');
  const originalBytes = rawBuffer.length;
  const sha256 = computeSha256(rawBuffer);

  const compressedBuffer = zlib.gzipSync(rawBuffer);
  const compressedBytes = compressedBuffer.length;
  const compressionRatio = originalBytes > 0 ? Number((originalBytes / compressedBytes).toFixed(2)) : 1.0;

  const manifest: StorageManifest = {
    encoding: 'gzip',
    originalBytes,
    compressedBytes,
    compressionRatio,
    sha256,
    schemaVersion,
    storagePath,
    createdAt: new Date().toISOString(),
  };

  return {
    compressedBuffer,
    manifest,
  };
}

/**
 * Decompresses a Tier B artifact and validates the cryptographic SHA-256 integrity
 */
export function decompressPayload<T = Record<string, unknown>>(
  compressedBuffer: Buffer,
  manifest: StorageManifest
): T {
  let decompressedBuffer: Buffer;
  if (manifest.encoding === 'gzip') {
    decompressedBuffer = zlib.gunzipSync(compressedBuffer);
  } else {
    decompressedBuffer = compressedBuffer;
  }

  // Validate integrity checksum
  const actualHash = computeSha256(decompressedBuffer);
  if (actualHash !== manifest.sha256) {
    throw new Error(
      `[StorageTier Integrity Error] SHA-256 mismatch: expected ${manifest.sha256}, got ${actualHash}`
    );
  }

  const rawString = decompressedBuffer.toString('utf8');
  return JSON.parse(rawString) as T;
}
