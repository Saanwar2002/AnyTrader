/**
 * AnyTrader V8.3 — Task 29 Contractor Archive Rights Boundary Unit Test Suite
 * 
 * Verifies:
 * - Deterministic archive ID and component ID generation
 * - Conservative default permissions (unknown != allowed)
 * - Explicit purpose independence (internal_ai_use vs external_ai_training vs commercial_licensing)
 * - Internal AI bot preservation (internal_ai_use: 'allowed')
 * - External AI training & commercial licensing never inferred from upload, possession, or internal AI
 * - Mixed-origin archive safety (customer_or_subject_data, third_party_data, unknown_origin)
 * - Restriction enforcement (restrict_all_ai, restrict_external_ai_training, etc.)
 * - Revocation handling (status: revoked => blocked_by_status)
 * - Strict tenant isolation & cross-tenant rejection
 * - Server-authoritative eligibility decision boundary
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeContractorArchiveId,
  computeArchiveComponentId,
  createDefaultContractorArchivePurposes,
  ContractorArchiveRightsService,
  ContractorArchiveSecurityError,
  ContractorArchiveValidationError,
  ARCHIVE_ORIGIN_TYPES,
  ARCHIVE_COMPONENT_CATEGORIES,
} from './contractorArchiveRights';
import {
  DataRightsRecord,
  RightsPurpose,
  createDefaultPurposes,
  createStandardInternalPlatformPurposes,
} from './dataRights';

// Mock in-memory storage for unit testing service methods
class MockFirestoreCollection {
  private store = new Map<string, any>();

  doc(id: string) {
    return {
      id,
      get: async () => ({
        exists: this.store.has(id),
        data: () => this.store.get(id),
      }),
      set: async (data: any) => {
        this.store.set(id, { ...data });
      },
    };
  }

  _getStore() {
    return this.store;
  }
}

class MockFirestoreDb {
  public collections = new Map<string, MockFirestoreCollection>();

  collection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockFirestoreCollection());
    }
    return this.collections.get(name)!;
  }

  async runTransaction(updateFunction: (transaction: any) => Promise<any>) {
    const tx = {
      get: async (docRef: any) => docRef.get(),
      set: (docRef: any, data: any) => docRef.set(data),
    };
    return updateFunction(tx);
  }
}

describe('V8.3 Task 29 — Contractor Archive Rights Boundary Unit Tests', () => {
  let mockDb: any;
  let archiveService: ContractorArchiveRightsService;

  beforeEach(() => {
    mockDb = new MockFirestoreDb();
    archiveService = new ContractorArchiveRightsService(mockDb);
  });

  // ---------------------------------------------------------------------------
  // 1. DETERMINISTIC ARCHIVE & COMPONENT IDENTITY
  // ---------------------------------------------------------------------------
  describe('Vector 1: Deterministic Identity & Hash Generation', () => {
    it('generates deterministic archive IDs for identical inputs', () => {
      const id1 = computeContractorArchiveId('contractor_123', 'job_archive_2026_q1');
      const id2 = computeContractorArchiveId('contractor_123', 'job_archive_2026_q1');
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^arch_[a-f0-9]{24}$/);
    });

    it('generates distinct archive IDs for differing tenants or references', () => {
      const idA = computeContractorArchiveId('contractor_A', 'archive_001');
      const idB = computeContractorArchiveId('contractor_B', 'archive_001');
      const idC = computeContractorArchiveId('contractor_A', 'archive_002');
      expect(idA).not.toBe(idB);
      expect(idA).not.toBe(idC);
    });

    it('generates deterministic component IDs', () => {
      const comp1 = computeArchiveComponentId('contractor_123', 'arch_001', 'photo_roof_01');
      const comp2 = computeArchiveComponentId('contractor_123', 'arch_001', 'photo_roof_01');
      expect(comp1).toBe(comp2);
      expect(comp1).toMatch(/^acomp_[a-f0-9]{24}$/);
    });

    it('rejects empty or whitespace parameters for ID generation', () => {
      expect(() => computeContractorArchiveId('', 'ref1')).toThrow(ContractorArchiveValidationError);
      expect(() => computeContractorArchiveId('   ', 'ref1')).toThrow(ContractorArchiveValidationError);
      expect(() => computeContractorArchiveId('tenant_1', '')).toThrow(ContractorArchiveValidationError);
      expect(() => computeArchiveComponentId('', 'arch_1', 'comp_1')).toThrow(ContractorArchiveValidationError);
      expect(() => computeArchiveComponentId('tenant_1', '', 'comp_1')).toThrow(ContractorArchiveValidationError);
      expect(() => computeArchiveComponentId('tenant_1', 'arch_1', '')).toThrow(ContractorArchiveValidationError);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. CONSERVATIVE DEFAULT PERMISSIONS & UNKNOWN != ALLOWED
  // ---------------------------------------------------------------------------
  describe('Vector 2: Conservative Default Permissions', () => {
    it('sets conservative defaults: internal AI allowed, external AI & commercial unknown', () => {
      const defaults = createDefaultContractorArchivePurposes(true);
      expect(defaults.internal_platform_operation).toBe('allowed');
      expect(defaults.internal_ai_use).toBe('allowed');
      expect(defaults.external_ai_training).toBe('unknown');
      expect(defaults.third_party_sharing).toBe('unknown');
      expect(defaults.commercial_licensing).toBe('unknown');
      expect(defaults.export).toBe('unknown');
    });

    it('respects internal AI disablement without altering conservative external purposes', () => {
      const defaults = createDefaultContractorArchivePurposes(false);
      expect(defaults.internal_platform_operation).toBe('allowed');
      expect(defaults.internal_ai_use).toBe('denied');
      expect(defaults.external_ai_training).toBe('unknown');
      expect(defaults.commercial_licensing).toBe('unknown');
    });

    it('treats unknown permissions strictly as non-eligible (unknown != allowed)', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_100',
        contractorUid: 'contractor_100',
        archiveReference: 'archive_ref_conservative',
        allowInternalAi: true,
      });

      // Internal AI should be allowed
      const evalInternal = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_100',
        archiveId: reg.archiveId,
        purpose: 'internal_ai_use',
      });
      expect(evalInternal.eligible).toBe(true);
      expect(evalInternal.reason).toBe('allowed');

      // External AI training is unknown => must be in-eligible
      const evalExternal = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_100',
        archiveId: reg.archiveId,
        purpose: 'external_ai_training',
      });
      expect(evalExternal.eligible).toBe(false);
      expect(evalExternal.reason).toBe('unknown');

      // Commercial licensing is unknown => must be in-eligible
      const evalCommercial = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_100',
        archiveId: reg.archiveId,
        purpose: 'commercial_licensing',
      });
      expect(evalCommercial.eligible).toBe(false);
      expect(evalCommercial.reason).toBe('unknown');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. PURPOSE INDEPENDENCE & INTERNAL AI PRESERVATION
  // ---------------------------------------------------------------------------
  describe('Vector 3: Purpose Independence & Internal AI Preservation', () => {
    it('internal AI allowance does NOT grant external AI training or commercial licensing', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_ai_test',
        contractorUid: 'contractor_ai_test',
        archiveReference: 'historical_boilers',
        allowInternalAi: true,
      });

      expect(reg.rightsRecord.purposes.internal_ai_use).toBe('allowed');
      expect(reg.rightsRecord.purposes.external_ai_training).toBe('unknown');
      expect(reg.rightsRecord.purposes.commercial_licensing).toBe('unknown');

      const externalResult = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_ai_test',
        archiveId: reg.archiveId,
        purpose: 'external_ai_training',
      });
      expect(externalResult.eligible).toBe(false);

      const commercialResult = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_ai_test',
        archiveId: reg.archiveId,
        purpose: 'commercial_licensing',
      });
      expect(commercialResult.eligible).toBe(false);
    });

    it('archive upload and possession never imply commercial licensing', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_possession',
        contractorUid: 'contractor_possession',
        archiveReference: 'uploaded_photos_and_quotes',
      });

      const commercial = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_possession',
        archiveId: reg.archiveId,
        purpose: 'commercial_licensing',
      });
      expect(commercial.eligible).toBe(false);
      expect(commercial.reason).toBe('unknown');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. MIXED-ORIGIN ARCHIVE SAFETY
  // ---------------------------------------------------------------------------
  describe('Vector 4: Mixed-Origin Handling', () => {
    it('validates supported origin types and component categories', () => {
      expect(ARCHIVE_ORIGIN_TYPES).toContain('contractor_owned');
      expect(ARCHIVE_ORIGIN_TYPES).toContain('customer_or_subject_data');
      expect(ARCHIVE_ORIGIN_TYPES).toContain('third_party_data');
      expect(ARCHIVE_ORIGIN_TYPES).toContain('platform_generated');
      expect(ARCHIVE_ORIGIN_TYPES).toContain('unknown_origin');

      expect(ARCHIVE_COMPONENT_CATEGORIES).toContain('photograph');
      expect(ARCHIVE_COMPONENT_CATEGORIES).toContain('estimate_quote');
      expect(ARCHIVE_COMPONENT_CATEGORIES).toContain('certificate');
    });

    it('mixed-origin archive blocks external use for customer and third-party data (blocked_by_origin)', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_mixed',
        contractorUid: 'contractor_mixed',
        archiveReference: 'archive_with_mixed_components',
        components: [
          {
            componentKey: 'contractor_quote',
            originType: 'contractor_owned',
            category: 'estimate_quote',
          },
          {
            componentKey: 'customer_gas_meter_photo',
            originType: 'customer_or_subject_data',
            category: 'photograph',
          },
          {
            componentKey: 'manufacturer_boiler_manual',
            originType: 'third_party_data',
            category: 'report',
          },
        ],
      });

      expect(reg.componentRights?.length).toBe(3);

      const customerPhotoId = computeArchiveComponentId(
        'contractor_mixed',
        reg.archiveId,
        'customer_gas_meter_photo'
      );

      // archive_mixed_origin_customer_data_external_blocked:
      // Evaluating customer data for external AI training is blocked by origin
      const evalCustomerExternal = await archiveService.evaluateComponentEligibility({
        tenantId: 'contractor_mixed',
        archiveId: reg.archiveId,
        componentId: customerPhotoId,
        purpose: 'external_ai_training',
        originType: 'customer_or_subject_data',
      });
      expect(evalCustomerExternal.eligible).toBe(false);
      expect(evalCustomerExternal.reason).toBe('blocked_by_origin');

      // archive_mixed_origin_third_party_data_external_blocked:
      // Evaluating third-party data for commercial licensing is blocked by origin
      const thirdPartyDocId = computeArchiveComponentId(
        'contractor_mixed',
        reg.archiveId,
        'manufacturer_boiler_manual'
      );
      const evalThirdPartyCommercial = await archiveService.evaluateComponentEligibility({
        tenantId: 'contractor_mixed',
        archiveId: reg.archiveId,
        componentId: thirdPartyDocId,
        purpose: 'commercial_licensing',
        originType: 'third_party_data',
      });
      expect(evalThirdPartyCommercial.eligible).toBe(false);
      expect(evalThirdPartyCommercial.reason).toBe('blocked_by_origin');
    });

    it('rejects invalid origin types or categories with validation error', async () => {
      await expect(
        archiveService.registerComponentRights({
          tenantId: 'contractor_val',
          archiveId: 'arch_val_1',
          component: {
            componentKey: 'comp_invalid',
            originType: 'invalid_origin' as any,
            category: 'photograph',
          },
        })
      ).rejects.toThrow(ContractorArchiveValidationError);

      await expect(
        archiveService.registerComponentRights({
          tenantId: 'contractor_val',
          archiveId: 'arch_val_1',
          component: {
            componentKey: 'comp_invalid_cat',
            originType: 'contractor_owned',
            category: 'invalid_category' as any,
          },
        })
      ).rejects.toThrow(ContractorArchiveValidationError);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. RESTRICTIONS & REVOCATION HANDLING
  // ---------------------------------------------------------------------------
  describe('Vector 5: Restrictions and Revocation', () => {
    it('enforces purpose-specific restrictions', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_restr',
        contractorUid: 'contractor_restr',
        archiveReference: 'restricted_archive',
        restrictions: ['restrict_external_ai_training'],
        purposes: {
          external_ai_training: 'allowed', // Even if specified as allowed, restriction overrides
        },
      });

      const evalResult = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_restr',
        archiveId: reg.archiveId,
        purpose: 'external_ai_training',
      });
      expect(evalResult.eligible).toBe(false);
      expect(evalResult.reason).toBe('blocked_by_restriction');
    });

    it('enforces restrict_all_ai blanket restriction', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_all_ai',
        contractorUid: 'contractor_all_ai',
        archiveReference: 'no_ai_allowed_archive',
        restrictions: ['restrict_all_ai'],
        allowInternalAi: true,
      });

      const evalResult = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_all_ai',
        archiveId: reg.archiveId,
        purpose: 'internal_ai_use',
      });
      expect(evalResult.eligible).toBe(false);
      expect(evalResult.reason).toBe('blocked_by_restriction');
    });

    it('revocation transitions rights to status revoked and blocks future use', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'contractor_revoke',
        contractorUid: 'contractor_revoke',
        archiveReference: 'to_be_revoked',
        allowInternalAi: true,
      });

      // Before revocation: eligible
      const before = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_revoke',
        archiveId: reg.archiveId,
        purpose: 'internal_ai_use',
      });
      expect(before.eligible).toBe(true);

      // Revoke rights
      await archiveService.revokeArchiveRights(
        'contractor_revoke',
        reg.archiveId,
        'Contractor requested archive deletion'
      );

      // After revocation: blocked by status
      const after = await archiveService.evaluateArchiveEligibility({
        tenantId: 'contractor_revoke',
        archiveId: reg.archiveId,
        purpose: 'internal_ai_use',
      });
      expect(after.eligible).toBe(false);
      expect(after.reason).toBe('blocked_by_status');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. TENANT ISOLATION & CROSS-TENANT DEFENSE
  // ---------------------------------------------------------------------------
  describe('Vector 6: Tenant Isolation & Cross-Tenant Defense', () => {
    it('rejects registration when contractorUid does not match tenantId', async () => {
      await expect(
        archiveService.registerArchiveRights({
          tenantId: 'tenant_contractor_A',
          contractorUid: 'contractor_B', // Mismatch!
          archiveReference: 'cross_tenant_archive',
        })
      ).rejects.toThrow(ContractorArchiveSecurityError);
    });

    it('blocks cross-tenant evaluation requests', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'tenant_contractor_A',
        contractorUid: 'tenant_contractor_A',
        archiveReference: 'private_archive_A',
        allowInternalAi: true,
      });

      // Caller from tenant_contractor_B attempting to evaluate tenant A's archive
      const evalCross = await archiveService.evaluateArchiveEligibility({
        tenantId: 'tenant_contractor_A',
        archiveId: reg.archiveId,
        purpose: 'internal_ai_use',
        requestedByUid: 'tenant_contractor_B',
        isAdmin: false,
      });

      expect(evalCross.eligible).toBe(false);
      expect(evalCross.reason).toBe('blocked_by_tenant');
    });

    it('allows administrator cross-tenant evaluation', async () => {
      const reg = await archiveService.registerArchiveRights({
        tenantId: 'tenant_contractor_A',
        contractorUid: 'tenant_contractor_A',
        archiveReference: 'admin_evaluable_archive',
        allowInternalAi: true,
      });

      const evalAdmin = await archiveService.evaluateArchiveEligibility({
        tenantId: 'tenant_contractor_A',
        archiveId: reg.archiveId,
        purpose: 'internal_ai_use',
        requestedByUid: 'admin_user_001',
        isAdmin: true,
      });

      expect(evalAdmin.eligible).toBe(true);
      expect(evalAdmin.reason).toBe('allowed');
    });
  });
});
