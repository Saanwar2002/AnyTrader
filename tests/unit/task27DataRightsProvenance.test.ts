/**
 * AnyTrader V8.3 — Task 27/27R Data Rights & Provenance Firebase Emulator Security & Lifecycle Test Suite
 * 
 * CANONICAL TENANT MODEL ARCHITECTURAL INVARIANT:
 * - AnyTrader's canonical identity model across the repository is strictly UID-as-tenant (1:1 binding between user UID and tenant isolation partition: tenantId === request.auth.uid).
 * - There is no separate tenant, company, or multi-user organization membership table in the repository.
 * - Under this model, a user cannot have simultaneous ambient membership in multiple tenants.
 * - The authoritative authorization invariant enforced is:
 *     "OWNER UID MUST NEVER INDEPENDENTLY BYPASS TENANT ISOLATION"
 * - If a data rights record or history record belongs to Tenant A (tenantId == 'tenant_A'), a caller authenticated as User X (request.auth.uid == 'user_X') is strictly DENIED access, EVEN IF User X is listed as the record's owner (owner.id == 'user_X').
 * - Client-supplied tenant substitution cannot bypass authorization because Firestore rules evaluate against immutable server-verified request.auth.uid, and all client write operations are strictly denied (allow create, update, delete: if false;).
 * 
 * TESTS COVERED:
 * 1. Legitimate same-tenant access succeeds (/data_rights)
 * 2. Legitimate same-tenant access succeeds (/data_rights_history)
 * 3. Unrelated tenant access fails (/data_rights)
 * 4. Unrelated tenant access fails (/data_rights_history)
 * 5. Unauthenticated access fails (/data_rights)
 * 6. Unauthenticated access fails (/data_rights_history)
 * 7. Admin access behaves according to existing admin policy (/data_rights)
 * 8. Admin access behaves according to existing admin policy (/data_rights_history)
 * 9. Owner identity cannot bypass tenant isolation (cross-UID owner bypass rejected on /data_rights)
 * 10. Owner identity cannot bypass tenant isolation (cross-UID owner bypass rejected on /data_rights_history)
 * 11. Client-supplied tenant substitution cannot bypass authorization on read
 * 12. Client-supplied tenant substitution cannot bypass authorization on write
 * 13. Client creation, modification, deletion strictly denied (Server Admin SDK only)
 * 14. Client writes to /data_rights_history strictly denied (Append-Only Immutable History)
 */

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { createStandardInternalPlatformPurposes, computeDataRightsHash } from '../../src/server/intelligence/dataRights';

describe('V8.3 Task 27R — Firebase Emulator Data Rights Security & Persistence Suite', () => {
  let testEnv: RulesTestEnvironment;
  const PROJECT_ID = 'demo-anytrader';
  const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');

  beforeAll(async () => {
    try {
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          rules: firestoreRules,
          host: '127.0.0.1',
          port: 8088,
        },
      });
    } catch (err) {
      console.error('FATAL ERROR: Failed to initialize Firebase emulator test environment for Task 27R!', err);
      throw err;
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  // -------------------------------------------------------------------------
  // 1. UNAUTHENTICATED ACCESS DEFENSE
  // -------------------------------------------------------------------------
  it('Vector 8: Unauthenticated client read to /data_rights/{rightsId} is strictly denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const prov = {
        sourceType: 'job',
        sourceId: 'job_001',
        tenantId: 'tenant_owner_1',
      };
      const record = {
        rightsId: 'rights_sec_001',
        tenantId: 'tenant_owner_1',
        owner: { type: 'user', id: 'tenant_owner_1' },
        subject: { type: 'job', id: 'job_001' },
        source: { type: 'job', id: 'job_001', tenantId: 'tenant_owner_1' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        status: 'active' as const,
        version: 1,
        provenance: {
          ...prov,
          rightsHash: computeDataRightsHash({
            rightsId: 'rights_sec_001',
            tenantId: 'tenant_owner_1',
            owner: { type: 'user', id: 'tenant_owner_1' },
            subject: { type: 'job', id: 'job_001' },
            source: { type: 'job', id: 'job_001', tenantId: 'tenant_owner_1' },
            purposes: createStandardInternalPlatformPurposes(true),
            restrictions: [],
            version: 1,
            provenance: prov,
            status: 'active',
            effectiveAt: new Date().toISOString(),
          }),
        },
        effectiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'data_rights', 'rights_sec_001'), record);
    });

    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthDb, 'data_rights', 'rights_sec_001')));
  });

  it('Vector 8B: Unauthenticated client read to /data_rights_history/{historyId} is strictly denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'data_rights_history', 'hist_sec_001'), {
        historyId: 'hist_sec_001',
        rightsId: 'rights_sec_001',
        tenantId: 'tenant_owner_1',
        owner: { type: 'user', id: 'tenant_owner_1' },
        subject: { type: 'job', id: 'job_001' },
        source: { type: 'job', id: 'job_001', tenantId: 'tenant_owner_1' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        status: 'active',
        version: 1,
        provenance: { sourceType: 'job', sourceId: 'job_001', tenantId: 'tenant_owner_1' },
      });
    });

    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthDb, 'data_rights_history', 'hist_sec_001')));
  });

  // -------------------------------------------------------------------------
  // 2. UNRELATED TENANT ACCESS DEFENSE
  // -------------------------------------------------------------------------
  it('Vector 9: Unrelated tenant client read to /data_rights/{rightsId} is strictly denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'data_rights', 'rights_sec_002'), {
        rightsId: 'rights_sec_002',
        tenantId: 'tenant_owner_1',
        owner: { type: 'user', id: 'tenant_owner_1' },
        subject: { type: 'job', id: 'job_002' },
        source: { type: 'job', id: 'job_002', tenantId: 'tenant_owner_1' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        status: 'active',
        version: 1,
        provenance: { sourceType: 'job', sourceId: 'job_002', tenantId: 'tenant_owner_1' },
        effectiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    const attackerDb = testEnv.authenticatedContext('attacker_user_999').firestore();
    await assertFails(getDoc(doc(attackerDb, 'data_rights', 'rights_sec_002')));
  });

  it('Vector 9D: Unrelated tenant client read to /data_rights_history/{historyId} is strictly denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'data_rights_history', 'hist_sec_002'), {
        historyId: 'hist_sec_002',
        rightsId: 'rights_sec_002',
        tenantId: 'tenant_owner_1',
        owner: { type: 'user', id: 'tenant_owner_1' },
        subject: { type: 'job', id: 'job_002' },
        source: { type: 'job', id: 'job_002', tenantId: 'tenant_owner_1' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        status: 'active',
        version: 1,
        provenance: { sourceType: 'job', sourceId: 'job_002', tenantId: 'tenant_owner_1' },
      });
    });

    const attackerDb = testEnv.authenticatedContext('attacker_user_999').firestore();
    await assertFails(getDoc(doc(attackerDb, 'data_rights_history', 'hist_sec_002')));
  });

  // -------------------------------------------------------------------------
  // 3. CROSS-TENANT / CROSS-UID OWNER BYPASS DEFENSE
  // Invariant: Owner UID must never independently bypass tenant authorization
  // -------------------------------------------------------------------------
  it('Vector 9B (Task 27R Adversarial): Cross-tenant owner bypass denied on /data_rights — User X owns record in Tenant A but reading from non-tenant context is denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      // Record belongs to Tenant A (tenantId: tenant_A), but owner.id is user_X
      await setDoc(doc(db, 'data_rights', 'rights_tenant_a_001'), {
        rightsId: 'rights_tenant_a_001',
        tenantId: 'tenant_A',
        owner: { type: 'user', id: 'user_X' },
        subject: { type: 'job', id: 'job_tenant_a' },
        source: { type: 'job', id: 'job_tenant_a', tenantId: 'tenant_A' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        status: 'active',
        version: 1,
        provenance: { sourceType: 'job', sourceId: 'job_tenant_a', tenantId: 'tenant_A' },
        effectiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // user_X attempts to read Tenant A's record directly; denied because tenantId (tenant_A) != request.auth.uid (user_X)
    const userXDb = testEnv.authenticatedContext('user_X').firestore();
    await assertFails(getDoc(doc(userXDb, 'data_rights', 'rights_tenant_a_001')));
  });

  it('Vector 9C (Task 27R Adversarial): Cross-tenant owner bypass denied on /data_rights_history', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'data_rights_history', 'hist_tenant_a_001'), {
        historyId: 'hist_tenant_a_001',
        rightsId: 'rights_tenant_a_001',
        tenantId: 'tenant_A',
        owner: { type: 'user', id: 'user_X' },
        subject: { type: 'job', id: 'job_tenant_a' },
        source: { type: 'job', id: 'job_tenant_a', tenantId: 'tenant_A' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        status: 'active',
        version: 1,
        provenance: { sourceType: 'job', sourceId: 'job_tenant_a', tenantId: 'tenant_A' },
      });
    });

    const userXDb = testEnv.authenticatedContext('user_X').firestore();
    await assertFails(getDoc(doc(userXDb, 'data_rights_history', 'hist_tenant_a_001')));
  });

  // -------------------------------------------------------------------------
  // 4. CLIENT TENANT SUBSTITUTION DEFENSE
  // -------------------------------------------------------------------------
  it('Vector 9E: Client-supplied tenant substitution on read is strictly denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'data_rights', 'rights_target_estate'), {
        rightsId: 'rights_target_estate',
        tenantId: 'victim_tenant_estate_456',
        owner: { type: 'user', id: 'victim_tenant_estate_456' },
        subject: { type: 'property', id: 'prop_victim_123' },
        source: { type: 'property', id: 'prop_victim_123', tenantId: 'victim_tenant_estate_456' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        status: 'active',
        version: 1,
        provenance: { sourceType: 'property', sourceId: 'prop_victim_123', tenantId: 'victim_tenant_estate_456' },
      });
    });

    // Attacker client attempting to read victim document using their own auth context
    const attackerDb = testEnv.authenticatedContext('attacker_user_789').firestore();
    await assertFails(getDoc(doc(attackerDb, 'data_rights', 'rights_target_estate')));
  });

  it('Vector 9F: Client-supplied tenant substitution on /data_rights_history read is strictly denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'data_rights_history', 'hist_target_estate'), {
        historyId: 'hist_target_estate',
        rightsId: 'rights_target_estate',
        tenantId: 'victim_tenant_estate_456',
        owner: { type: 'user', id: 'victim_tenant_estate_456' },
        subject: { type: 'property', id: 'prop_victim_123' },
        source: { type: 'property', id: 'prop_victim_123', tenantId: 'victim_tenant_estate_456' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        status: 'active',
        version: 1,
        provenance: { sourceType: 'property', sourceId: 'prop_victim_123', tenantId: 'victim_tenant_estate_456' },
      });
    });

    const attackerDb = testEnv.authenticatedContext('attacker_user_789').firestore();
    await assertFails(getDoc(doc(attackerDb, 'data_rights_history', 'hist_target_estate')));
  });

  // -------------------------------------------------------------------------
  // 5. AUTHORIZED SAME-TENANT & ADMIN ACCESS
  // -------------------------------------------------------------------------
  it('Vector 10: Authorized tenant read to /data_rights/{rightsId} succeeds', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'data_rights', 'rights_sec_003'), {
        rightsId: 'rights_sec_003',
        tenantId: 'authorized_user_123',
        owner: { type: 'user', id: 'authorized_user_123' },
        subject: { type: 'job', id: 'job_003' },
        source: { type: 'job', id: 'job_003', tenantId: 'authorized_user_123' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        status: 'active',
        version: 1,
        provenance: { sourceType: 'job', sourceId: 'job_003', tenantId: 'authorized_user_123' },
        effectiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    const authDb = testEnv.authenticatedContext('authorized_user_123').firestore();
    await assertSucceeds(getDoc(doc(authDb, 'data_rights', 'rights_sec_003')));
  });

  it('Vector 10B: Admin read to /data_rights/{rightsId} succeeds across tenants', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'data_rights', 'rights_sec_003b'), {
        rightsId: 'rights_sec_003b',
        tenantId: 'tenant_client_abc',
        owner: { type: 'user', id: 'tenant_client_abc' },
        subject: { type: 'job', id: 'job_003b' },
        source: { type: 'job', id: 'job_003b', tenantId: 'tenant_client_abc' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        status: 'active',
        version: 1,
        provenance: { sourceType: 'job', sourceId: 'job_003b', tenantId: 'tenant_client_abc' },
        effectiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    const adminDb = testEnv.authenticatedContext('admin_user_root', { admin: true }).firestore();
    await assertSucceeds(getDoc(doc(adminDb, 'data_rights', 'rights_sec_003b')));
  });

  it('Vector 10C: Authorized tenant read to /data_rights_history/{historyId} succeeds', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'data_rights_history', 'hist_sec_003c'), {
        historyId: 'hist_sec_003c',
        rightsId: 'rights_sec_003c',
        tenantId: 'authorized_user_123',
        owner: { type: 'user', id: 'authorized_user_123' },
        subject: { type: 'job', id: 'job_003c' },
        source: { type: 'job', id: 'job_003c', tenantId: 'authorized_user_123' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        status: 'active',
        version: 1,
        provenance: { sourceType: 'job', sourceId: 'job_003c', tenantId: 'authorized_user_123' },
      });
    });

    const authDb = testEnv.authenticatedContext('authorized_user_123').firestore();
    await assertSucceeds(getDoc(doc(authDb, 'data_rights_history', 'hist_sec_003c')));
  });

  it('Vector 10D: Admin read to /data_rights_history/{historyId} succeeds across tenants', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'data_rights_history', 'hist_sec_003d'), {
        historyId: 'hist_sec_003d',
        rightsId: 'rights_sec_003d',
        tenantId: 'tenant_client_xyz',
        owner: { type: 'user', id: 'tenant_client_xyz' },
        subject: { type: 'job', id: 'job_003d' },
        source: { type: 'job', id: 'job_003d', tenantId: 'tenant_client_xyz' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        status: 'active',
        version: 1,
        provenance: { sourceType: 'job', sourceId: 'job_003d', tenantId: 'tenant_client_xyz' },
      });
    });

    const adminDb = testEnv.authenticatedContext('admin_user_root', { admin: true }).firestore();
    await assertSucceeds(getDoc(doc(adminDb, 'data_rights_history', 'hist_sec_003d')));
  });

  // -------------------------------------------------------------------------
  // 6. CLIENT WRITE RESTRICTIONS & FAIL-CLOSED DEFENSE (Server Admin SDK Only)
  // -------------------------------------------------------------------------
  it('Vector 11: Client creation of /data_rights is strictly denied (Server Admin SDK only)', async () => {
    const authDb = testEnv.authenticatedContext('authorized_user_123').firestore();
    await assertFails(
      setDoc(doc(authDb, 'data_rights', 'rights_client_illegal'), {
        rightsId: 'rights_client_illegal',
        tenantId: 'authorized_user_123',
        owner: { type: 'user', id: 'authorized_user_123' },
        subject: { type: 'job', id: 'job_004' },
        source: { type: 'job', id: 'job_004' },
        purposes: { commercial_licensing: 'allowed' },
        status: 'active',
        version: 1,
      })
    );
  });

  it('Vector 11B: Client creation with substituted foreign tenantId is strictly denied', async () => {
    const authDb = testEnv.authenticatedContext('attacker_user_999').firestore();
    await assertFails(
      setDoc(doc(authDb, 'data_rights', 'rights_spoofed_tenant'), {
        rightsId: 'rights_spoofed_tenant',
        tenantId: 'victim_tenant_123',
        owner: { type: 'user', id: 'attacker_user_999' },
        subject: { type: 'job', id: 'job_victim_123' },
        source: { type: 'job', id: 'job_victim_123' },
        purposes: { commercial_licensing: 'allowed' },
        status: 'active',
        version: 1,
      })
    );
  });

  it('Vector 12: Client modification of /data_rights is strictly denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'data_rights', 'rights_sec_005'), {
        rightsId: 'rights_sec_005',
        tenantId: 'authorized_user_123',
        owner: { type: 'user', id: 'authorized_user_123' },
        subject: { type: 'job', id: 'job_005' },
        source: { type: 'job', id: 'job_005' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        status: 'active',
        version: 1,
        provenance: { sourceType: 'job', sourceId: 'job_005' },
      });
    });

    const authDb = testEnv.authenticatedContext('authorized_user_123').firestore();
    await assertFails(
      updateDoc(doc(authDb, 'data_rights', 'rights_sec_005'), {
        'purposes.commercial_licensing': 'allowed',
      })
    );
  });

  it('Vector 12B: Client modification attempting to substitute tenantId is strictly denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'data_rights', 'rights_sec_005b'), {
        rightsId: 'rights_sec_005b',
        tenantId: 'authorized_user_123',
        owner: { type: 'user', id: 'authorized_user_123' },
        subject: { type: 'job', id: 'job_005b' },
        source: { type: 'job', id: 'job_005b' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        status: 'active',
        version: 1,
        provenance: { sourceType: 'job', sourceId: 'job_005b' },
      });
    });

    const authDb = testEnv.authenticatedContext('authorized_user_123').firestore();
    await assertFails(
      updateDoc(doc(authDb, 'data_rights', 'rights_sec_005b'), {
        tenantId: 'hacked_foreign_tenant_999',
      })
    );
  });

  it('Vector 13: Client deletion of /data_rights is strictly denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'data_rights', 'rights_sec_006'), {
        rightsId: 'rights_sec_006',
        tenantId: 'authorized_user_123',
        owner: { type: 'user', id: 'authorized_user_123' },
        subject: { type: 'job', id: 'job_006' },
        source: { type: 'job', id: 'job_006' },
        purposes: createStandardInternalPlatformPurposes(true),
        status: 'active',
        version: 1,
      });
    });

    const authDb = testEnv.authenticatedContext('authorized_user_123').firestore();
    await assertFails(deleteDoc(doc(authDb, 'data_rights', 'rights_sec_006')));
  });

  it('Vector 14: Client writes to /data_rights_history are strictly denied (Immutable Append-Only History)', async () => {
    const authDb = testEnv.authenticatedContext('authorized_user_123').firestore();
    await assertFails(
      setDoc(doc(authDb, 'data_rights_history', 'hist_client_illegal'), {
        historyId: 'hist_client_illegal',
        rightsId: 'rights_sec_007',
        tenantId: 'authorized_user_123',
      })
    );
  });
});
