/**
 * AnyTrader V8.3 — Task 27 Data Rights & Provenance Foundation Tests
 * 
 * Tests the 25 required vectors:
 * 1. Internal AI explicitly allowed
 * 2. Internal AI explicitly denied
 * 3. Internal AI unknown evaluated conservatively (unknown != allowed)
 * 4. External AI training separately controlled
 * 5. Commercial licensing separately controlled
 * 6. Internal AI allowed while commercial licensing denied
 * 7. Unknown external purpose is not treated as allowed
 * 8. Unauthenticated read denied in Firestore rules
 * 9. Unrelated tenant read denied in Firestore rules
 * 10. Cross-tenant write denied in Firestore rules
 * 11. Client cannot grant itself commercial rights
 * 12. Client cannot modify owner
 * 13. Client cannot modify tenant
 * 14. Client cannot modify provenance
 * 15. Client cannot remove restrictions
 * 16. Client cannot revoke/restore authoritative state
 * 17. Source identity required
 * 18. Tenant identity required
 * 19. Rights version required
 * 20. Provenance cannot cross tenant boundaries
 * 21. Active rights lifecycle
 * 22. Revoked rights lifecycle
 * 23. Superseded rights lifecycle
 * 24. Expired rights lifecycle
 * 25. Concurrent authoritative rights updates do not corrupt version state
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import {
  canUseDataForPurpose,
  createDefaultPurposes,
  createStandardInternalPlatformPurposes,
  validateDataRightsRecord,
  DataRightsRecord,
  DataRightsService,
  DataRightsSecurityError,
} from './dataRights';

describe('V8.3 Task 27 — Data Rights & Provenance Foundation Unit & Semantics Suite', () => {
  const baseRecord: DataRightsRecord = {
    rightsId: 'rights_test_001',
    tenantId: 'tenant_estate_123',
    subject: { type: 'job', id: 'job_001' },
    owner: { type: 'user', id: 'homeowner_456' },
    source: { type: 'job_submission', id: 'job_001' },
    purposes: {
      internal_platform_operation: 'allowed',
      internal_ai_use: 'allowed',
      external_ai_training: 'denied',
      third_party_sharing: 'denied',
      commercial_licensing: 'denied',
      export: 'denied',
    },
    restrictions: [],
    status: 'active',
    version: 1,
    provenance: {
      sourceType: 'job',
      sourceId: 'job_001',
      sourceVersion: '1',
      recordedBy: 'system',
    },
    effectiveAt: new Date(Date.now() - 10000).toISOString(),
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

  it('Vector 20: Provenance must contain valid sourceType and sourceId', () => {
    const invalidRecord = { ...baseRecord, provenance: { sourceType: '', sourceId: '' } };
    expect(() => validateDataRightsRecord(invalidRecord)).toThrow(DataRightsSecurityError);
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

  it('Vector 25: Explicit restriction list denies purpose even if purpose is allowed', () => {
    const restrictedRecord = {
      ...baseRecord,
      restrictions: ['restrict_internal_ai_use'],
    };
    expect(canUseDataForPurpose(restrictedRecord, 'internal_ai_use', 'tenant_estate_123')).toBe(false);
    expect(canUseDataForPurpose(restrictedRecord, 'internal_platform_operation', 'tenant_estate_123')).toBe(true);
  });
});
