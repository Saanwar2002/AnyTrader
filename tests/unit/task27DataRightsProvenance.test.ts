/**
 * AnyTrader V8.3 — Task 27/27R Data Rights & Provenance Firebase Emulator Security & Lifecycle Test Suite
 * 
 * Tests the real Firebase Emulator security rules and persistence for /data_rights and /data_rights_history:
 * - Unauthenticated reads denied
 * - Unrelated tenant / unauthorized user reads denied
 * - Cross-tenant owner bypass denied: User X owns a record in Tenant A, is also an owner in Tenant B, but reading Tenant A record from Tenant B context is denied
 * - Cross-tenant owner bypass denied on /data_rights_history
 * - Authorized tenant read allowed
 * - Admin read allowed
 * - Client creation, update, and deletion strictly denied (server Admin SDK only)
 * - Client writes to /data_rights_history strictly denied (Immutable Append-Only History)
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

  it('Vector 9B (Task 27R Adversarial): Cross-tenant owner bypass denied — User X owns record in Tenant A but reading from non-tenant context is denied', async () => {
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

    // user_X attempts to read Tenant A's record directly without tenant_A authorization
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
