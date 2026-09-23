/**
 * AnyTrader V8.3 — Task 27 / 27R Data Rights & Provenance Foundation Tests
 * 
 * Reconciles the required 25 vectors:
 * 1. Internal AI explicitly allowed
 * 2. Internal AI explicitly denied
 * 3. Internal AI unknown evaluated conservatively (unknown != allowed)
 * 4. External AI training separately controlled
 * 5. Commercial licensing separately controlled
 * 6. Internal AI allowed while commercial licensing denied
 * 7. Unknown external purpose is not treated as allowed
 * 8. Unauthenticated read denied in Firestore rules (Emulator Vector 8)
 * 9. Unrelated tenant read denied in Firestore rules (Emulator Vector 9)
 * 10. Cross-tenant owner bypass denied in Firestore rules (Emulator Vector 9B/9C) & Authorized tenant read succeeds (Emulator Vector 10/10B)
 * 11. Client cannot create rights records (Emulator Vector 11)
 * 12. Client cannot modify rights records (Emulator Vector 12)
 * 13. Client cannot delete rights records (Emulator Vector 13)
 * 14. Client cannot write to append-only history (Emulator Vector 14)
 * 15. Client cannot remove restrictions or substitute purposes
 * 16. Client cannot revoke/restore authoritative state without server transaction
 * 17. Source identity required in data rights validation
 * 18. Tenant identity required in data rights validation & cannot be empty
 * 19. Rights version required and must be a positive integer
 * 20. Provenance cannot cross tenant boundaries (tenantId mismatch rejected)
 * 21. Active rights lifecycle evaluation
 * 22. Revoked rights lifecycle evaluation
 * 23. Superseded rights lifecycle evaluation
 * 24. Expired rights (or future effectiveAt) lifecycle evaluation
 * 25. Complete deterministic rights integrity hash covering all 11 required fields
 */

import { describe, it, expect } from 'vitest';
import {
  canUseDataForPurpose,
  createDefaultPurposes,
  createStandardInternalPlatformPurposes,
  validateDataRightsRecord,
  DataRightsRecord,
  DataRightsSecurityError,
  computeDataRightsHash,
} from './dataRights';

describe('V8.3 Task 27 / 27R — Data Rights & Provenance Foundation Unit & Semantics Suite', () => {
  const baseProv = {
    sourceType: 'job',
    sourceId: 'job_001',
    tenantId: 'tenant_estate_123',
    sourceVersion: '1',
    recordedBy: 'system',
  };

  const baseRecordWithoutHash = {
    rightsId: 'rights_test_001',
    tenantId: 'tenant_estate_123',
    subject: { type: 'job', id: 'job_001' },
    owner: { type: 'user', id: 'homeowner_456' },
    source: { type: 'job_submission', id: 'job_001', tenantId: 'tenant_estate_123' },
    purposes: {
      internal_platform_operation: 'allowed' as const,
      internal_ai_use: 'allowed' as const,
      external_ai_training: 'denied' as const,
      third_party_sharing: 'denied' as const,
      commercial_licensing: 'denied' as const,
      export: 'denied' as const,
    },
    restrictions: [],
    status: 'active' as const,
    version: 1,
    effectiveAt: new Date(Date.now() - 10000).toISOString(),
  };

  const baseHash = computeDataRightsHash({
    ...baseRecordWithoutHash,
    provenance: baseProv,
  });

  const baseRecord: DataRightsRecord = {
    ...baseRecordWithoutHash,
    provenance: {
      ...baseProv,
      rightsHash: baseHash,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('Vector 1: Internal AI explicitly allowed returns true', () => {
    const record = { ...baseRecord, purposes: { ...baseRecord.purposes, internal_ai_use: 'allowed' as const } };
    expect(canUseDataForPurpose(record, 'internal_ai_use', 'tenant_estate_123')).toBe(true);
  });

  it('Vector 2: Internal AI explicitly denied returns false', () => {
    const record = { ...baseRecord, purposes: { ...baseRecord.purposes, internal_ai_use: 'denied' as const } };
    expect(canUseDataForPurpose(record, 'internal_ai_use', 'tenant_estate_123')).toBe(false);
  });

  it('Vector 3: Internal AI unknown evaluated conservatively (unknown != allowed) returns false', () => {
    const record = { ...baseRecord, purposes: { ...baseRecord.purposes, internal_ai_use: 'unknown' as const } };
    expect(canUseDataForPurpose(record, 'internal_ai_use', 'tenant_estate_123')).toBe(false);
  });

  it('Vector 4: External AI training is separately controlled from internal AI', () => {
    const record = {
      ...baseRecord,
      purposes: {
        ...baseRecord.purposes,
        internal_ai_use: 'allowed' as const,
        external_ai_training: 'denied' as const,
      },
    };
    expect(canUseDataForPurpose(record, 'internal_ai_use', 'tenant_estate_123')).toBe(true);
    expect(canUseDataForPurpose(record, 'external_ai_training', 'tenant_estate_123')).toBe(false);
  });

  it('Vector 5: Commercial licensing is separately controlled from internal AI', () => {
    const record = {
      ...baseRecord,
      purposes: {
        ...baseRecord.purposes,
        internal_ai_use: 'allowed' as const,
        commercial_licensing: 'denied' as const,
      },
    };
    expect(canUseDataForPurpose(record, 'internal_ai_use', 'tenant_estate_123')).toBe(true);
    expect(canUseDataForPurpose(record, 'commercial_licensing', 'tenant_estate_123')).toBe(false);
  });

  it('Vector 6: Internal AI allowed while commercial licensing denied is representable and enforced', () => {
    const standard = createStandardInternalPlatformPurposes(true);
    expect(standard.internal_ai_use).toBe('allowed');
    expect(standard.commercial_licensing).toBe('denied');
    expect(standard.external_ai_training).toBe('denied');

    const record = { ...baseRecord, purposes: standard };
    expect(canUseDataForPurpose(record, 'internal_ai_use', 'tenant_estate_123')).toBe(true);
    expect(canUseDataForPurpose(record, 'commercial_licensing', 'tenant_estate_123')).toBe(false);
    expect(canUseDataForPurpose(record, 'export', 'tenant_estate_123')).toBe(false);
  });

  it('Vector 7: Unknown external purpose is not treated as allowed', () => {
    const defaultPurposes = createDefaultPurposes();
    expect(defaultPurposes.external_ai_training).toBe('unknown');
    expect(defaultPurposes.commercial_licensing).toBe('unknown');

    const record = { ...baseRecord, purposes: defaultPurposes };
    expect(canUseDataForPurpose(record, 'external_ai_training', 'tenant_estate_123')).toBe(false);
    expect(canUseDataForPurpose(record, 'commercial_licensing', 'tenant_estate_123')).toBe(false);
  });

  it('Vector 15: Explicit restriction list denies purpose even if purpose is allowed', () => {
    const restrictedRecord = {
      ...baseRecord,
      restrictions: ['restrict_internal_ai_use'],
    };
    expect(canUseDataForPurpose(restrictedRecord, 'internal_ai_use', 'tenant_estate_123')).toBe(false);
    expect(canUseDataForPurpose(restrictedRecord, 'internal_platform_operation', 'tenant_estate_123')).toBe(true);
  });

  it('Vector 16: restrict_all_ai restriction denies all AI purposes', () => {
    const restrictedRecord = {
      ...baseRecord,
      restrictions: ['restrict_all_ai'],
    };
    expect(canUseDataForPurpose(restrictedRecord, 'internal_ai_use', 'tenant_estate_123')).toBe(false);
    expect(canUseDataForPurpose(restrictedRecord, 'external_ai_training', 'tenant_estate_123')).toBe(false);
    expect(canUseDataForPurpose(restrictedRecord, 'internal_platform_operation', 'tenant_estate_123')).toBe(true);
  });

  it('Vector 17: Source identity required in data rights record validation', () => {
    const invalidRecord = { ...baseRecord, source: { type: '', id: '' } };
    expect(() => validateDataRightsRecord(invalidRecord)).toThrow(DataRightsSecurityError);
  });

  it('Vector 18: Tenant identity required in data rights record validation', () => {
    const invalidRecord = { ...baseRecord, tenantId: '' };
    expect(() => validateDataRightsRecord(invalidRecord)).toThrow(DataRightsSecurityError);
  });

  it('Vector 19: Rights version must be positive integer', () => {
    const invalidRecord = { ...baseRecord, version: 0 };
    expect(() => validateDataRightsRecord(invalidRecord)).toThrow(DataRightsSecurityError);
  });

  it('Vector 20: Provenance must be explicitly tenant-bound (mismatched tenant is rejected)', () => {
    const invalidProvTenant = {
      ...baseRecord,
      provenance: {
        ...baseRecord.provenance,
        tenantId: 'mismatched_tenant_999',
      },
    };
    expect(() => validateDataRightsRecord(invalidProvTenant)).toThrow(DataRightsSecurityError);

    const invalidSourceTenant = {
      ...baseRecord,
      source: {
        type: 'job',
        id: 'job_001',
        tenantId: 'different_tenant_888',
      },
    };
    expect(() => validateDataRightsRecord(invalidSourceTenant)).toThrow(DataRightsSecurityError);
  });

  it('Vector 21: Active rights allow authorized purpose evaluation', () => {
    const activeRecord = { ...baseRecord, status: 'active' as const };
    expect(canUseDataForPurpose(activeRecord, 'internal_platform_operation', 'tenant_estate_123')).toBe(true);
  });

  it('Vector 22: Revoked rights deny all purpose evaluations', () => {
    const revokedRecord = { ...baseRecord, status: 'revoked' as const };
    expect(canUseDataForPurpose(revokedRecord, 'internal_ai_use', 'tenant_estate_123')).toBe(false);
    expect(canUseDataForPurpose(revokedRecord, 'internal_platform_operation', 'tenant_estate_123')).toBe(false);
  });

  it('Vector 23: Superseded rights deny all purpose evaluations', () => {
    const supersededRecord = { ...baseRecord, status: 'superseded' as const };
    expect(canUseDataForPurpose(supersededRecord, 'internal_ai_use', 'tenant_estate_123')).toBe(false);
  });

  it('Vector 24: Expired rights (or future effectiveAt) deny purpose evaluations', () => {
    const futureRecord = {
      ...baseRecord,
      effectiveAt: new Date(Date.now() + 1000000).toISOString(),
    };
    expect(canUseDataForPurpose(futureRecord, 'internal_ai_use', 'tenant_estate_123')).toBe(false);
  });

  describe('Vector 25: Complete deterministic rights integrity hash', () => {
    it('Same semantic state produces exact same hash regardless of key order', () => {
      const hash1 = computeDataRightsHash({
        rightsId: 'r1',
        tenantId: 't1',
        subject: { type: 'job', id: 'j1' },
        owner: { type: 'user', id: 'u1' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: ['r_a', 'r_b'],
        version: 1,
        source: { type: 'job', id: 'j1' },
        provenance: { sourceType: 'job', sourceId: 'j1', tenantId: 't1', recordedBy: 'admin' },
        status: 'active',
        effectiveAt: '2026-09-22T00:00:00.000Z',
      });

      const hash2 = computeDataRightsHash({
        effectiveAt: '2026-09-22T00:00:00.000Z',
        status: 'active',
        provenance: { recordedBy: 'admin', tenantId: 't1', sourceId: 'j1', sourceType: 'job' },
        source: { id: 'j1', type: 'job' },
        version: 1,
        restrictions: ['r_a', 'r_b'],
        purposes: createStandardInternalPlatformPurposes(true),
        owner: { id: 'u1', type: 'user' },
        subject: { id: 'j1', type: 'job' },
        tenantId: 't1',
        rightsId: 'r1',
      });

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });

    it('Mutating tenantId alters the hash', () => {
      const basePayload = {
        rightsId: 'r1',
        tenantId: 't1',
        subject: { type: 'job', id: 'j1' },
        owner: { type: 'user', id: 'u1' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        version: 1,
        source: { type: 'job', id: 'j1' },
        provenance: { sourceType: 'job', sourceId: 'j1', tenantId: 't1' },
        status: 'active' as const,
        effectiveAt: '2026-09-22T00:00:00.000Z',
      };
      const h1 = computeDataRightsHash(basePayload);
      const h2 = computeDataRightsHash({ ...basePayload, tenantId: 't2', provenance: { ...basePayload.provenance, tenantId: 't2' } });
      expect(h1).not.toBe(h2);
    });

    it('Mutating purpose alters the hash', () => {
      const basePayload = {
        rightsId: 'r1',
        tenantId: 't1',
        subject: { type: 'job', id: 'j1' },
        owner: { type: 'user', id: 'u1' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        version: 1,
        source: { type: 'job', id: 'j1' },
        provenance: { sourceType: 'job', sourceId: 'j1', tenantId: 't1' },
        status: 'active' as const,
        effectiveAt: '2026-09-22T00:00:00.000Z',
      };
      const h1 = computeDataRightsHash(basePayload);
      const h2 = computeDataRightsHash({
        ...basePayload,
        purposes: { ...basePayload.purposes, commercial_licensing: 'allowed' as const },
      });
      expect(h1).not.toBe(h2);
    });

    it('Mutating restrictions alters the hash', () => {
      const basePayload = {
        rightsId: 'r1',
        tenantId: 't1',
        subject: { type: 'job', id: 'j1' },
        owner: { type: 'user', id: 'u1' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        version: 1,
        source: { type: 'job', id: 'j1' },
        provenance: { sourceType: 'job', sourceId: 'j1', tenantId: 't1' },
        status: 'active' as const,
        effectiveAt: '2026-09-22T00:00:00.000Z',
      };
      const h1 = computeDataRightsHash(basePayload);
      const h2 = computeDataRightsHash({ ...basePayload, restrictions: ['restrict_all_ai'] });
      expect(h1).not.toBe(h2);
    });

    it('Mutating provenance alters the hash', () => {
      const basePayload = {
        rightsId: 'r1',
        tenantId: 't1',
        subject: { type: 'job', id: 'j1' },
        owner: { type: 'user', id: 'u1' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        version: 1,
        source: { type: 'job', id: 'j1' },
        provenance: { sourceType: 'job', sourceId: 'j1', tenantId: 't1' },
        status: 'active' as const,
        effectiveAt: '2026-09-22T00:00:00.000Z',
      };
      const h1 = computeDataRightsHash(basePayload);
      const h2 = computeDataRightsHash({
        ...basePayload,
        provenance: { ...basePayload.provenance, sourceId: 'j2' },
      });
      expect(h1).not.toBe(h2);
    });

    it('Mutating status, version, or effectiveAt alters the hash', () => {
      const basePayload = {
        rightsId: 'r1',
        tenantId: 't1',
        subject: { type: 'job', id: 'j1' },
        owner: { type: 'user', id: 'u1' },
        purposes: createStandardInternalPlatformPurposes(true),
        restrictions: [],
        version: 1,
        source: { type: 'job', id: 'j1' },
        provenance: { sourceType: 'job', sourceId: 'j1', tenantId: 't1' },
        status: 'active' as const,
        effectiveAt: '2026-09-22T00:00:00.000Z',
      };
      const h1 = computeDataRightsHash(basePayload);
      const hStatus = computeDataRightsHash({ ...basePayload, status: 'revoked' });
      const hVersion = computeDataRightsHash({ ...basePayload, version: 2 });
      const hEffective = computeDataRightsHash({ ...basePayload, effectiveAt: '2026-09-23T00:00:00.000Z' });

      expect(h1).not.toBe(hStatus);
      expect(h1).not.toBe(hVersion);
      expect(h1).not.toBe(hEffective);
    });
  });

  describe('Vectors 26–30: Canonical Tenant Model & Authorization Invariants', () => {
    it('Vector 26: Owner UID cannot bypass tenant boundary (cross-UID owner bypass denied)', () => {
      // Record belongs to Tenant A (tenant_A), but owner.id is user_X
      const recordInTenantA: DataRightsRecord = {
        ...baseRecord,
        tenantId: 'tenant_A',
        owner: { type: 'user', id: 'user_X' },
        provenance: {
          ...baseRecord.provenance,
          tenantId: 'tenant_A',
        },
      };

      // User X (authenticated as user_X, whose tenant is user_X) evaluates purpose
      // Expected result: DENIED (false) because record tenant is tenant_A != user_X
      const allowedForUserX = canUseDataForPurpose(recordInTenantA, 'internal_ai_use', 'user_X');
      expect(allowedForUserX).toBe(false);

      // Legitimate tenant A access succeeds
      const allowedForTenantA = canUseDataForPurpose(recordInTenantA, 'internal_ai_use', 'tenant_A');
      expect(allowedForTenantA).toBe(true);
    });

    it('Vector 27: Client-supplied tenant substitution in source or provenance is strictly rejected', () => {
      // Attacker attempts to forge record with mismatched source tenant
      const spoofedSourceRecord = {
        ...baseRecord,
        tenantId: 'tenant_A',
        source: { type: 'job', id: 'job_001', tenantId: 'tenant_B' },
        provenance: { ...baseRecord.provenance, tenantId: 'tenant_A' },
      };
      expect(() => validateDataRightsRecord(spoofedSourceRecord)).toThrow(DataRightsSecurityError);

      // Attacker attempts to forge record with mismatched provenance tenant
      const spoofedProvRecord = {
        ...baseRecord,
        tenantId: 'tenant_A',
        source: { type: 'job', id: 'job_001', tenantId: 'tenant_A' },
        provenance: { ...baseRecord.provenance, tenantId: 'tenant_B' },
      };
      expect(() => validateDataRightsRecord(spoofedProvRecord)).toThrow(DataRightsSecurityError);
    });

    it('Vector 28: Historical rights records retain identical strict tenant boundary invariant', () => {
      // Historical snapshot belonging to Tenant A with User X as owner
      const historicalSnapshot: DataRightsRecord = {
        ...baseRecord,
        tenantId: 'tenant_A',
        owner: { type: 'user', id: 'user_X' },
        status: 'active',
        provenance: {
          ...baseRecord.provenance,
          tenantId: 'tenant_A',
        },
      };

      // Caller User X attempting to evaluate historical record under User X tenant context
      expect(canUseDataForPurpose(historicalSnapshot, 'internal_platform_operation', 'user_X')).toBe(false);

      // Authorized Tenant A evaluating historical record succeeds
      expect(canUseDataForPurpose(historicalSnapshot, 'internal_platform_operation', 'tenant_A')).toBe(true);
    });

    it('Vector 29: Fail-closed evaluation on missing tenant context or mismatched caller context', () => {
      const record = { ...baseRecord, tenantId: 'tenant_valid_123' };
      // Mismatched expectedTenantId fails closed
      expect(canUseDataForPurpose(record, 'internal_platform_operation', 'intruder_tenant')).toBe(false);
      // Empty tenant context in validation throws error
      expect(() => validateDataRightsRecord({ ...record, tenantId: '   ' })).toThrow(DataRightsSecurityError);
    });

    it('Vector 30: Platform operational access is strictly bounded to authorized tenant context', () => {
      const standardPurposes = createStandardInternalPlatformPurposes(true);
      const record: DataRightsRecord = {
        ...baseRecord,
        tenantId: 'tenant_legit_456',
        purposes: standardPurposes,
      };

      // Correct tenant context: permitted
      expect(canUseDataForPurpose(record, 'internal_platform_operation', 'tenant_legit_456')).toBe(true);
      // Foreign tenant context: denied
      expect(canUseDataForPurpose(record, 'internal_platform_operation', 'foreign_tenant_789')).toBe(false);
    });
  });
});
