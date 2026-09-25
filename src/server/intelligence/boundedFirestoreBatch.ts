/**
 * AnyTrader V8.3 — Task 33: Bounded Firestore Batch & Cursor Operations
 * 
 * Reusable utility for chunking Firestore writes into safe bounded batches
 * (<= 400 operations, strictly under the 500 operation limit) and executing
 * bounded cursor-based queries without unbounded in-memory collection scans.
 */

import { SCALE_LIMITS } from './scaleLimits';

export interface BoundedBatchResult {
  totalOperations: number;
  batchesCommitted: number;
  success: boolean;
}

export interface BoundedWriteOperation {
  type: 'set' | 'update' | 'delete';
  ref: any;
  data?: any;
  options?: any;
}

/**
 * Commits an array of Firestore write operations in bounded chunks
 * to prevent exceeding Firestore's 500-operation transaction limit.
 */
export async function commitBoundedBatches(
  db: any,
  operations: BoundedWriteOperation[],
  batchLimit: number = SCALE_LIMITS.maxFirestoreBatchWrites
): Promise<BoundedBatchResult> {
  if (!operations || operations.length === 0) {
    return { totalOperations: 0, batchesCommitted: 0, success: true };
  }

  const safeLimit = Math.min(batchLimit, SCALE_LIMITS.maxFirestoreBatchWrites);
  let batchesCommitted = 0;

  for (let i = 0; i < operations.length; i += safeLimit) {
    const chunk = operations.slice(i, i + safeLimit);
    const batch = db.batch();

    for (const op of chunk) {
      if (op.type === 'set') {
        if (op.options) {
          batch.set(op.ref, op.data, op.options);
        } else {
          batch.set(op.ref, op.data);
        }
      } else if (op.type === 'update') {
        batch.update(op.ref, op.data);
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    }

    await batch.commit();
    batchesCommitted++;
  }

  return {
    totalOperations: operations.length,
    batchesCommitted,
    success: true,
  };
}

export interface CursorPaginationOptions {
  pageSize?: number;
  maxTotalRecords?: number;
}

/**
 * Iterates through a Firestore query in bounded pages using query document cursors,
 * avoiding unbounded memory consumption or timeouts.
 */
export async function iterateBoundedQuery<T = any>(
  baseQuery: any,
  processPage: (items: T[], pageNumber: number) => Promise<boolean | void>,
  options: CursorPaginationOptions = {}
): Promise<{ totalProcessed: number; pagesProcessed: number }> {
  const pageSize = Math.min(
    options.pageSize || SCALE_LIMITS.defaultCursorPageSize,
    SCALE_LIMITS.maxCursorPageSize
  );
  const maxTotal = options.maxTotalRecords || Infinity;

  let totalProcessed = 0;
  let pagesProcessed = 0;
  let lastDoc: any = null;

  while (totalProcessed < maxTotal) {
    let pageQuery = baseQuery.limit(pageSize);
    if (lastDoc) {
      pageQuery = pageQuery.startAfter(lastDoc);
    }

    const snap = await pageQuery.get();
    if (snap.empty || snap.docs.length === 0) {
      break;
    }

    const items: T[] = snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    pagesProcessed++;
    totalProcessed += items.length;

    const shouldContinue = await processPage(items, pagesProcessed);
    if (shouldContinue === false) {
      break;
    }

    if (snap.docs.length < pageSize) {
      break;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return { totalProcessed, pagesProcessed };
}
