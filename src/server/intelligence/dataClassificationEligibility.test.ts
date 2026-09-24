/**
 * AnyTrader V8.3 — Task 30 Data Classification & Eligibility Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DataClassificationEligibilityService,
  DataClassificationSecurityError,
  DataClassificationValidationError,
  computeDataClassificationId,
  computeClassificationContentHash,
  DATA_CLASSIFICATION_CATEGORIES,
  SENSITIVITY_LEVELS,
} from './dataClassificationEligibility';
import { DataRightsService } from './dataRights';
import { ProvenanceGraphService } from './provenanceGraph';
import { ContractorArchiveRightsService } from './contractorArchiveRights';

describe('Task 30 DataClassificationEligibilityService Unit Tests', () => {
  let service: DataClassificationEligibilityService;

  beforeEach(() => {
    // Instantiate with in-memory service instances (no live Firestore required for unit tests)
    service = new DataClassificationEligibilityService();
  });

  describe('Deterministic Identification & Hashing', () => {
    it('generates identical classificationId for identical tenantId, recordType, and recordId', () => {
      const id1 = computeDataClassificationId('tenant_123', 'property_record', 'prop_456');
      const id2 = computeDataClassificationId('tenant_123', 'property_record', 'prop_456');
      expect(id1).toBe(id2);
      expect(id1.startsWith('dclass_')).toBe(true);
    });

    it('generates distinct classificationIds for different tenants or records', () => {
      const id1 = computeDataClassificationId('tenant_123', 'property_record', 'prop_456');
      const id2 = computeDataClassificationId('tenant_999', 'property_record', 'prop_456');
      const id3 = computeDataClassificationId('tenant_123', 'job_record', 'prop_456');
      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
    });

    it('throws validation error when mandatory identification params are missing', () => {
      expect(() => computeDataClassificationId('', 'job', 'id')).toThrow(DataClassificationValidationError);
      expect(() => computeDataClassificationId('tenant', '', 'id')).toThrow(DataClassificationValidationError);
      expect(() => computeDataClassificationId('tenant', 'job', '')).toThrow(DataClassificationValidationError);
    });

    it('computes deterministic contentHash over canonical classification fields', () => {
      const record = {
        classificationId: 'dclass_test',
        tenantId: 'tenant_123',
        recordType: 'inspection',
        recordId: 'insp_100',
        category: 'property_intelligence' as const,
        sensitivity: 'confidential' as const,
        restrictions: ['no_export'],
        version: 1,
        provenanceRef: {
          tenantId: 'tenant_123',
          sourceType: 'user_upload',
          sourceId: 'upload_1',
        },
        status: 'active' as const,
      };

      const hash1 = computeClassificationContentHash(record);
      const hash2 = computeClassificationContentHash(record);
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBe(64); // SHA-256 hex length
    });
  });

  describe('Classification Input Validation & Security Rules', () => {
    it('validates controlled classification categories', () => {
      expect(DATA_CLASSIFICATION_CATEGORIES).toContain('transactional_operational');
      expect(DATA_CLASSIFICATION_CATEGORIES).toContain('property_intelligence');
      expect(DATA_CLASSIFICATION_CATEGORIES).toContain('contractor_archive');
      expect(DATA_CLASSIFICATION_CATEGORIES).toContain('customer_subject');
      expect(DATA_CLASSIFICATION_CATEGORIES).toContain('third_party');
      expect(DATA_CLASSIFICATION_CATEGORIES).toContain('platform_derived_intelligence');
      expect(DATA_CLASSIFICATION_CATEGORIES).toContain('provenance_evidence_metadata');
      expect(DATA_CLASSIFICATION_CATEGORIES).toContain('unknown_unclassified');
    });

    it('validates all 5 canonical sensitivity levels', () => {
      expect(SENSITIVITY_LEVELS).toEqual(['public', 'internal', 'confidential', 'restricted', 'pii']);
    });

    it('rejects missing or empty tenantId in provenance reference', async () => {
      await expect(
        service.registerClassification({
          tenantId: 'tenant_A',
          recordType: 'invoice',
          recordId: 'inv_123',
          category: 'transactional_operational',
          provenanceRef: {
            tenantId: '',
            sourceType: 'system',
            sourceId: 'sys_1',
          },
        })
      ).rejects.toThrow(DataClassificationSecurityError);
    });

    it('rejects invalid classification category', async () => {
      await expect(
        service.registerClassification({
          tenantId: 'tenant_A',
          recordType: 'invoice',
          recordId: 'inv_123',
          category: 'invalid_category_xyz' as any,
          provenanceRef: {
            tenantId: 'tenant_A',
            sourceType: 'system',
            sourceId: 'sys_1',
          },
        })
      ).rejects.toThrow(DataClassificationValidationError);
    });

    it('rejects cross-tenant provenance reference', async () => {
      await expect(
        service.registerClassification({
          tenantId: 'tenant_A',
          recordType: 'invoice',
          recordId: 'inv_123',
          category: 'transactional_operational',
          provenanceRef: {
            tenantId: 'tenant_B', // Cross-tenant!
            sourceType: 'system',
            sourceId: 'sys_1',
          },
        })
      ).rejects.toThrow(DataClassificationSecurityError);
    });

    it('rejects cross-tenant rights reference', async () => {
      await expect(
        service.registerClassification({
          tenantId: 'tenant_A',
          recordType: 'invoice',
          recordId: 'inv_123',
          category: 'transactional_operational',
          provenanceRef: {
            tenantId: 'tenant_A',
            sourceType: 'system',
            sourceId: 'sys_1',
          },
          rightsRef: {
            rightsId: 'rights_99',
            tenantId: 'tenant_B', // Cross-tenant!
          },
        })
      ).rejects.toThrow(DataClassificationSecurityError);
    });

    it('rejects cross-tenant archive reference', async () => {
      await expect(
        service.registerClassification({
          tenantId: 'tenant_A',
          recordType: 'photo',
          recordId: 'photo_123',
          category: 'contractor_archive',
          provenanceRef: {
            tenantId: 'tenant_A',
            sourceType: 'system',
            sourceId: 'sys_1',
          },
          archiveRef: {
            archiveId: 'arch_88',
            tenantId: 'tenant_B', // Cross-tenant!
          },
        })
      ).rejects.toThrow(DataClassificationSecurityError);
    });
  });

  describe('Eligibility Purpose Separation & Invariants', () => {
    it('blocks caller identity mismatch with outcome blocked_by_tenant', async () => {
      const decision = await service.evaluateEligibility({
        tenantId: 'tenant_A',
        recordType: 'job',
        recordId: 'job_1',
        requestedPurpose: 'internal_platform_operation',
        context: {
          callerUid: 'tenant_B', // Caller != Tenant
        },
      });

      expect(decision.eligible).toBe(false);
      expect(decision.outcome).toBe('blocked_by_tenant');
      expect(decision.reason).toContain('Caller identity does not match');
    });

    it('blocks unclassified data for external purposes with outcome blocked_by_classification', async () => {
      const decision = await service.evaluateEligibility({
        tenantId: 'tenant_A',
        recordType: 'unregistered_job',
        recordId: 'job_999',
        requestedPurpose: 'external_ai_training',
      });

      expect(decision.eligible).toBe(false);
      expect(decision.outcome).toBe('blocked_by_classification');
      expect(decision.category).toBe('unknown_unclassified');
    });

    it('blocks commercial licensing for unclassified data', async () => {
      const decision = await service.evaluateEligibility({
        tenantId: 'tenant_A',
        recordType: 'unregistered_photo',
        recordId: 'photo_999',
        requestedPurpose: 'commercial_licensing',
      });

      expect(decision.eligible).toBe(false);
      expect(decision.outcome).toBe('blocked_by_classification');
    });

    it('blocks export for unclassified data', async () => {
      const decision = await service.evaluateEligibility({
        tenantId: 'tenant_A',
        recordType: 'unregistered_data',
        recordId: 'data_999',
        requestedPurpose: 'export',
      });

      expect(decision.eligible).toBe(false);
      expect(decision.outcome).toBe('blocked_by_classification');
    });
  });
});
