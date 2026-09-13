/**
 * AnyTrader V8.1 — Intelligence Test Doubles
 * 
 * Provides an in-memory test double DB implementing FirestoreDbLike interface
 * exclusively for isolated unit tests that do not run against live Firestore emulator.
 * NOT used as a production fallback.
 */

import { FirestoreDbLike } from './immutableStore';

export function createInMemoryTestDb(): FirestoreDbLike {
  const collections = new Map<string, Map<string, any>>();

  function getCollectionMap(name: string) {
    if (!collections.has(name)) {
      collections.set(name, new Map());
    }
    return collections.get(name)!;
  }

  const db: FirestoreDbLike = {
    collection(colName: string) {
      const col = getCollectionMap(colName);
      return {
        doc(docId: string) {
          return {
            id: docId,
            get: async () => {
              const val = col.get(docId);
              return {
                id: docId,
                exists: val !== undefined,
                data: () => (val !== undefined ? JSON.parse(JSON.stringify(val)) : undefined),
              };
            },
            set: async (data: any, options?: { merge?: boolean }) => {
              if (options?.merge && col.has(docId)) {
                col.set(docId, { ...col.get(docId), ...JSON.parse(JSON.stringify(data)) });
              } else {
                col.set(docId, JSON.parse(JSON.stringify(data)));
              }
            },
            update: async (data: any) => {
              if (!col.has(docId)) throw new Error(`Document ${colName}/${docId} not found`);
              col.set(docId, { ...col.get(docId), ...JSON.parse(JSON.stringify(data)) });
            },
          };
        },
        where(field: string, op: string, value: any) {
          const conditions: Array<{ field: string; op: string; value: any }> = [{ field, op, value }];
          const queryObj = {
            where(nextField: string, nextOp: string, nextValue: any) {
              conditions.push({ field: nextField, op: nextOp, value: nextValue });
              return queryObj;
            },
            get: async () => {
              const matches: any[] = [];
              for (const [id, val] of col.entries()) {
                const satisfies = conditions.every((cond) => {
                  if (cond.op === '==') return val[cond.field] === cond.value;
                  return true;
                });
                if (satisfies) {
                  matches.push({
                    id,
                    exists: true,
                    data: () => JSON.parse(JSON.stringify(val)),
                  });
                }
              }
              return { docs: matches, empty: matches.length === 0 };
            },
          };
          return queryObj;
        },
      };
    },
    runTransaction: async <T>(updateFunction: (tx: any) => Promise<T>): Promise<T> => {
      const tx = {
        get: async (ref: any) => ref.get(),
        set: (ref: any, data: any, options?: { merge?: boolean }) => {
          ref.set(data, options);
        },
        update: (ref: any, data: any) => {
          ref.update(data);
        },
      };
      return await updateFunction(tx);
    },
    batch: () => {
      const operations: Array<() => Promise<void>> = [];
      return {
        set: (ref: any, data: any, options?: { merge?: boolean }) => {
          operations.push(async () => { await ref.set(data, options); });
        },
        commit: async () => {
          for (const op of operations) {
            await op();
          }
        },
      };
    },
  };

  return db;
}
