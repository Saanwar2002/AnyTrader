/**
 * AnyTrader V8.3 — Task 31 AI Training & Usage Controls Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AiTrainingUsageControlsService,
  AiUsageControlsSecurityError,
  AiUsageControlsValidationError,
  computeAiControlId,
  computeAiControlContentHash,
  computeAiDecisionHash,
  AI_USAGE_PURPOSES,
  AI_TRAINING_CONSENT_STATUSES,
} from './aiTrainingUsageControls';

describe('Task 31 AiTrainingUsageControlsService Unit Tests', () => {
  let service: AiTrainingUsageControlsService;

  beforeEach(() => {
    service = new AiTrainingUsageControlsService();
  });

  describe('Deterministic Identification & Hashing', () => {
    it('generates identical controlId for identical tenantId, recordType, and recordId', () => {
      const id1 = computeAiControlId('tenant_123', 'property_passport', 'pass_999');
      const id2 = computeAiControlId('tenant_123', 'property_passport', 'pass_999');
      expect(id1).toBe(id2);
      expect(id1.startsWith('aicontrol_')).toBe(true);
    });

    it('generates distinct controlIds for different tenants or records', () => {
      const id1 = computeAiControlId('tenant_123', 'property_passport', 'pass_999');
      const id2 = computeAiControlId('tenant_456', 'property_passport', 'pass_999');
      const id3 = computeAiControlId('tenant_123', 'job_record', 'pass_999');
      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
    });

    it('throws validation error when mandatory identification params are missing', () => {
      expect(() => computeAiControlId('', 'job', 'id')).toThrow(AiUsageControlsValidationError);
      expect(() => computeAiControlId('tenant', '', 'id')).toThrow(AiUsageControlsValidationError);
      expect(() => computeAiControlId('tenant', 'job', '')).toThrow(AiUsageControlsValidationError);
    });

    it('computes deterministic contentHash over canonical control fields', () => {
      const record = {
        controlId: 'aicontrol_test',
        tenantId: 'tenant_123',
        recordType: 'buyer_intelligence',
        recordId: 'buyer_100',
        scope: 'canonical_record' as const,
        purposes: {
          internal_ai_use: 'allowed' as const,
          external_ai_training: 'denied' as const,
          third_party_sharing: 'denied' as const,
          commercial_licensing: 'denied' as const,
          export: 'denied' as const,
        },
        trainingConsent: 'opt_out' as const,
        modelTiersAllowed: ['internal_gemini_flash'],
        restrictions: ['no_external'],
        status: 'active' as const,
        version: 1,
        provenanceRef: {
          tenantId: 'tenant_123',
          sourceType: 'user_action',
          sourceId: 'action_1',
        },
      };

      const hash1 = computeAiControlContentHash(record);
      const hash2 = computeAiControlContentHash(record);
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBe(64); // SHA-256 hex length
    });

    it('computes deterministic decisionHash', () => {
      const decision = {
        tenantId: 'tenant_123',
        controlId: 'aicontrol_123',
        requestedPurpose: 'external_ai_training',
        outcome: 'blocked_by_consent',
        allowed: false,
        trainingConsent: 'opt_out',
        reasons: ['External AI training requires explicit opt_in consent'],
        evaluatedAt: '2026-09-24T12:00:00.000Z',
      };

      const hash1 = computeAiDecisionHash(decision);
      const hash2 = computeAiDecisionHash(decision);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });
  });

  describe('Controlled Vocabularies & Invariant Verification', () => {
    it('validates controlled AI usage purposes', () => {
      expect(AI_USAGE_PURPOSES).toEqual([
        'internal_ai_use',
        'external_ai_training',
        'third_party_sharing',
        'commercial_licensing',
        'export',
      ]);
    });

    it('validates training consent statuses', () => {
      expect(AI_TRAINING_CONSENT_STATUSES).toEqual(['opt_in', 'opt_out', 'unknown', 'revoked']);
    });

    it('rejects missing tenantId during registration input validation', async () => {
      await expect(
        service.registerAiUsageControls({
          tenantId: '',
          recordType: 'invoice',
          recordId: 'inv_100',
          provenanceRef: { tenantId: 'tenant_A' },
        })
      ).rejects.toThrow(AiUsageControlsValidationError);
    });

    it('rejects provenance tenant mismatch during registration', async () => {
      await expect(
        service.registerAiUsageControls({
          tenantId: 'tenant_A',
          recordType: 'invoice',
          recordId: 'inv_100',
          provenanceRef: { tenantId: 'tenant_B' },
        })
      ).rejects.toThrow(AiUsageControlsSecurityError);
    });

    it('rejects cross-tenant rights reference during registration', async () => {
      await expect(
        service.registerAiUsageControls({
          tenantId: 'tenant_A',
          recordType: 'invoice',
          recordId: 'inv_100',
          provenanceRef: { tenantId: 'tenant_A' },
          rightsRef: { rightsId: 'rights_1', tenantId: 'tenant_B' },
        })
      ).rejects.toThrow(AiUsageControlsSecurityError);
    });
  });
});
