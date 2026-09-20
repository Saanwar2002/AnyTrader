/**
 * AnyTrader V8.2 — Property Condition & Lifecycle Intelligence Service
 * 
 * Provides:
 * - Evidence-backed Property Condition Observations & Lifecycle State Management
 * - Append-only Immutable Historical Condition Records (`property_condition_history`)
 * - Observation vs Inference Distinction & Preservation
 * - Authoritative Property Existence Gate & Lineage Checks
 * - AI Security Boundary & Non-Promotion Enforcements
 * - Completed Job != Automatic Repair/Replacement Guardrail
 * - Unsupported Deterioration Prevention
 * - Bounded Property-Scoped Queries & Client Write Protection
 */

import { computeSha256 } from './provenance';
import { getGlobalIntelligenceDb } from './immutableStore';
import { resolveAuthoritativeJobPropertyId } from './jobIntelligence';
import { evidenceRegistry } from './evidenceRegistry';
import { validateComponentType, normalizeComponentType, EvidenceStatus } from './propertyOntology';
import { cleanUndefinedFields } from './evidence';
import {
  PropertyLifecycleState,
  PropertyConditionObservation,
  RecordConditionObservationInput,
  Provenance,
  PropertyBuildingComponent,
  PropertyIntelligence,
} from './types';

export class PropertyLifecycleService {
  private defaultDb?: any;

  constructor(options?: { firestoreDb?: any }) {
    if (options?.firestoreDb) {
      this.defaultDb = options.firestoreDb;
    }
  }

  public setFirestoreDb(db: any): void {
    this.defaultDb = db;
  }

  /**
   * Records a new property condition observation & lifecycle state record with fail-closed security.
   */
  public async recordConditionObservation(
    input: RecordConditionObservationInput,
    options?: { firestoreDb?: any; isVerifiedServerAction?: boolean }
  ): Promise<PropertyConditionObservation> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();

    if (!activeDb) {
      throw new Error('[PropertyLifecycle Error] Firestore database reference required for lifecycle observation');
    }

    // 1. Basic Parameter Validation
    if (!input.propertyId || typeof input.propertyId !== 'string' || input.propertyId.trim().length === 0) {
      throw new Error('[PropertyLifecycle Error] Valid propertyId is required');
    }
    if (!input.lifecycleState || typeof input.lifecycleState !== 'string') {
      throw new Error('[PropertyLifecycle Error] Valid lifecycleState is required');
    }

    // 2. Authoritative Property Existence Check (Fail Closed)
    const propDoc = await activeDb.collection('properties').doc(input.propertyId).get();
    if (!propDoc || !propDoc.exists) {
      throw new Error(`[PropertyLifecycle Violation] Property '${input.propertyId}' does not exist`);
    }
    const propData = typeof propDoc.data === 'function' ? propDoc.data() : propDoc.data;
    const authoritativeTenant = propData?.tenantId ?? propData?.landlordId ?? propData?.ownerId;

    // 3. Component Type Validation
    const componentType = validateComponentType(input.componentType);

    // 4. Evidence Requirement & Authority Check
    if (!input.evidenceIds || !Array.isArray(input.evidenceIds) || input.evidenceIds.length === 0) {
      throw new Error('[PropertyLifecycle Violation] Lifecycle state requires supporting evidence');
    }

    // 5. Cross-Tenant Contamination Check
    if (input.provenance?.tenantId && authoritativeTenant && input.provenance.tenantId !== authoritativeTenant) {
      throw new Error(
        `[CrossTenantContamination Violation] Tenant '${input.provenance.tenantId}' does not match property owner/tenant '${authoritativeTenant}'`
      );
    }

    // 6. Authoritative Job Lineage Verification
    if (input.sourceJobId || input.sourceType === 'job') {
      if (!input.sourceJobId) {
        throw new Error('[Lineage Resolution Error] sourceJobId is required when sourceType is job');
      }
      const authoritativeJobPropertyId = await resolveAuthoritativeJobPropertyId(activeDb, input.sourceJobId);
      if (authoritativeJobPropertyId !== input.propertyId) {
        throw new Error(
          `[PropertyLineage Violation] Job '${input.sourceJobId}' belongs to property '${authoritativeJobPropertyId}', not '${input.propertyId}'`
        );
      }
    }

    // 7. Verify Authoritative Evidence Existence & Property Boundary
    const propertyEvidence = await evidenceRegistry.getForAggregate('property', input.propertyId, activeDb);
    const validEvidenceMap = new Map<string, any>();
    propertyEvidence.forEach((e) => validEvidenceMap.set(e.evidenceId, e));

    if (input.sourceJobId) {
      const jobEvidence = await evidenceRegistry.getForAggregate('job', input.sourceJobId, activeDb);
      jobEvidence.forEach((e) => validEvidenceMap.set(e.evidenceId, e));
    }

    for (const evId of input.evidenceIds) {
      if (!validEvidenceMap.has(evId)) {
        // Direct Firestore lookup fallback in intelligence_evidence
        const evDoc = await activeDb.collection('intelligence_evidence').doc(evId).get();
        if (!evDoc || !evDoc.exists) {
          throw new Error(
            `[PropertyLifecycle Violation] Evidence '${evId}' is not authoritative for property '${input.propertyId}'`
          );
        }
        const evData = typeof evDoc.data === 'function' ? evDoc.data() : evDoc.data;

        // Evidence Identity Verification
        const docEvidenceId = evData?.evidenceId || evDoc.id;
        if (docEvidenceId !== evId) {
          throw new Error(
            `[PropertyLifecycle Violation] Evidence document ID '${docEvidenceId}' does not match requested evidence ID '${evId}'`
          );
        }

        // Tenant Boundary Verification
        if (evData?.tenantId && authoritativeTenant && evData.tenantId !== authoritativeTenant) {
          throw new Error(
            `[CrossTenantContamination Violation] Evidence tenant '${evData.tenantId}' does not match property owner/tenant '${authoritativeTenant}'`
          );
        }

        // Aggregate & Property/Job Lineage Verification
        const evPropId = evData?.propertyId || (evData?.aggregateType === 'property' ? evData?.aggregateId : undefined);
        const evJobId = evData?.sourceJobId || evData?.sourceId || (evData?.aggregateType === 'job' ? evData?.aggregateId : undefined);

        const matchesProperty = evPropId === input.propertyId;
        const matchesJob = Boolean(input.sourceJobId && evJobId === input.sourceJobId);

        if (!matchesProperty && !matchesJob) {
          throw new Error(
            `[PropertyLifecycle Violation] Evidence '${evId}' is not authoritative for property '${input.propertyId}'`
          );
        }

        validEvidenceMap.set(evId, evData);
      }
    }

    // 8. AI Security Boundary & AI Self-Promotion Defense
    const isAiOrigin = Boolean(
      input.provenance?.origin &&
        (input.provenance.origin.includes('ai') ||
          input.provenance.origin.includes('extraction') ||
          input.provenance.origin.includes('model') ||
          input.provenance.origin.includes('copilot') ||
          input.provenance.origin.includes('rollup'))
    );

    let finalStatus: EvidenceStatus = input.status || 'derived';

    if (finalStatus === 'verified' && isAiOrigin && !options?.isVerifiedServerAction) {
      throw new Error(
        `[AIPrivilegeEscalation Violation] AI-derived candidate from origin '${input.provenance.origin}' cannot set status 'verified' without server authorization`
      );
    }

    if (
      (input.lifecycleState === 'repaired' || input.lifecycleState === 'replaced') &&
      isAiOrigin &&
      !options?.isVerifiedServerAction
    ) {
      throw new Error(
        `[AIPrivilegeEscalation Violation] AI-derived candidate cannot directly establish '${input.lifecycleState}' state without explicit server verification`
      );
    }

    // 9. Completed Job != Automatic Repair / Replacement Guardrail
    if ((input.lifecycleState === 'repaired' || input.lifecycleState === 'replaced') && !options?.isVerifiedServerAction) {
      const validOutcomeTypes = [
        'completion_certificate',
        'outcome_verification',
        'work_completion',
        'repair_certificate',
        'invoice_receipt',
      ];

      const hasRegisteredOutcomeEvidence = Array.from(validEvidenceMap.values()).some((ev) =>
        validOutcomeTypes.includes(ev?.evidenceType || ev?.type)
      );

      const hasOutcomeEvidence = input.metadata?.isOutcomeVerified === true || hasRegisteredOutcomeEvidence;

      if (!hasOutcomeEvidence) {
        throw new Error(
          `[PropertyLifecycle Violation] Completed job requires supporting outcome evidence to establish '${input.lifecycleState}' state`
        );
      }
    }

    // 10. No Unsupported Deterioration Guardrail
    if (input.lifecycleState === 'observed_degraded' || input.lifecycleState === 'observed_critical') {
      const isInsufficientEvidence =
        input.metadata?.insufficientEvidence === true ||
        (!input.observationDetails?.conditionDescription && !input.observationDetails?.severity);

      if (isInsufficientEvidence) {
        throw new Error('[PropertyLifecycle Violation] Unsupported deterioration claim without evidence');
      }
    }

    // 11. Deterministic Content Identity & Idempotency
    const sortedEvidenceIds = [...input.evidenceIds].sort();
    const observedAtIso = input.observedAt || new Date().toISOString();

    const semanticStr = [
      input.propertyId,
      componentType,
      input.lifecycleState,
      observedAtIso,
      input.sourceId || input.sourceJobId || `properties/${input.propertyId}`,
      ...sortedEvidenceIds,
    ].join('|');

    const contentHash = computeSha256(semanticStr);
    const conditionId = `pc_${input.propertyId}_${contentHash.slice(0, 16)}`;
    const now = new Date().toISOString();

    const historyDocRef = activeDb.collection('property_condition_history').doc(conditionId);

    // Build Provenance
    const provenance: Provenance = {
      source: input.provenance.source || input.provenance.origin || 'manual',
      evidenceIds: sortedEvidenceIds,
      origin: input.provenance.origin,
      sourceId: input.provenance.sourceId || input.sourceJobId || `properties/${input.propertyId}`,
      sourceVersion: input.provenance.sourceVersion ? String(input.provenance.sourceVersion) : '1',
      pipelineVersion: input.provenance.pipelineVersion || 'v8.2.0',
      modelVersion: input.provenance.modelVersion || 'gemini-2.5-flash',
      promptVersion: input.provenance.promptVersion || 'v8.2.0',
      schemaVersion: input.provenance.schemaVersion || 'v8.2.0',
      generatedAt: now,
      sourceContentHash: contentHash,
      tenantId: input.provenance.tenantId || authoritativeTenant,
    };

    const record: PropertyConditionObservation = {
      conditionId,
      propertyId: input.propertyId,
      componentType,
      lifecycleState: input.lifecycleState,
      observedAt: observedAtIso,
      sourceType: input.sourceType,
      sourceId: input.sourceId || input.sourceJobId || `properties/${input.propertyId}`,
      sourceJobId: input.sourceJobId,
      evidenceIds: sortedEvidenceIds,
      confidence: input.confidence ?? 0.9,
      provenance,
      contentHash,
      status: finalStatus,
      observationDetails: input.observationDetails,
      inferenceDetails: input.inferenceDetails,
      createdAt: now,
      updatedAt: now,
    };

    // 12. Persist to Append-Only Historical Store via Atomic Transaction
    const payload = cleanUndefinedFields({
      ...record,
      updatedAt: now,
    });

    let isExistingRecord = false;
    let existingRecordData: any = null;

    if (typeof activeDb.runTransaction === 'function') {
      await activeDb.runTransaction(async (tx: any) => {
        const existingSnap = await tx.get(historyDocRef);
        const exists = existingSnap && (typeof existingSnap.exists === 'boolean' ? existingSnap.exists : (typeof existingSnap.exists === 'function' ? existingSnap.exists() : false));
        if (exists) {
          const existingData = typeof existingSnap.data === 'function' ? existingSnap.data() : existingSnap.data;
          if (existingData?.contentHash && existingData.contentHash !== contentHash) {
            throw new Error(
              `[PropertyLifecycle Violation] Immutable condition record '${conditionId}' already exists with conflicting contentHash`
            );
          }
          isExistingRecord = true;
          existingRecordData = existingData;
          return;
        }
        tx.set(historyDocRef, payload);
      });
    } else {
      const existingSnap = await historyDocRef.get();
      const exists = existingSnap && (typeof existingSnap.exists === 'boolean' ? existingSnap.exists : (typeof existingSnap.exists === 'function' ? existingSnap.exists() : false));
      if (exists) {
        const existingData = typeof existingSnap.data === 'function' ? existingSnap.data() : existingSnap.data;
        if (existingData?.contentHash && existingData.contentHash !== contentHash) {
          throw new Error(
            `[PropertyLifecycle Violation] Immutable condition record '${conditionId}' already exists with conflicting contentHash`
          );
        }
        isExistingRecord = true;
        existingRecordData = existingData;
      } else {
        await historyDocRef.set(payload);
      }
    }

    if (isExistingRecord) {
      return {
        conditionId,
        ...existingRecordData,
      } as PropertyConditionObservation;
    }

    // 13. Update Mutable Current Property Condition Projection
    await this.updatePropertyConditionProjection(input.propertyId, { firestoreDb: activeDb });

    return record;
  }

  /**
   * Bounded, property-scoped query for condition observation history.
   */
  public async getPropertyConditionHistory(
    propertyId: string,
    options?: { componentType?: string; limit?: number; firestoreDb?: any }
  ): Promise<PropertyConditionObservation[]> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) return [];

    const limitVal = Math.min(Math.max(options?.limit ?? 50, 1), 100);

    let query = activeDb.collection('property_condition_history').where('propertyId', '==', propertyId);

    if (options?.componentType) {
      const normType = normalizeComponentType(options.componentType);
      query = query.where('componentType', '==', normType);
    }

    // Database-level ordering and limit
    query = query.orderBy('observedAt', 'desc').limit(limitVal);

    const snap = await query.get();

    if (!snap || snap.empty) return [];

    const docs = typeof snap.docs !== 'undefined' ? snap.docs : [];
    const records: PropertyConditionObservation[] = docs.map((d: any) => {
      const data = typeof d.data === 'function' ? d.data() : d.data;
      return {
        conditionId: d.id || data.conditionId,
        ...data,
      };
    });

    return records;
  }

  /**
   * Updates current property condition projection in `intelligence_properties/{propertyId}`.
   */
  public async updatePropertyConditionProjection(
    propertyId: string,
    options?: { firestoreDb?: any }
  ): Promise<void> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) return;

    const history = await this.getPropertyConditionHistory(propertyId, { limit: 100, firestoreDb: activeDb });
    if (history.length === 0) return;

    // Group by componentType and select latest record per component
    const latestByComponent = new Map<string, PropertyConditionObservation>();
    for (const item of history) {
      if (!latestByComponent.has(item.componentType)) {
        latestByComponent.set(item.componentType, item);
      }
    }

    const buildingComponents: PropertyBuildingComponent[] = [];
    for (const [compType, obs] of latestByComponent.entries()) {
      buildingComponents.push({
        component: compType,
        condition: obs.observationDetails?.conditionDescription || obs.lifecycleState,
        lifecycleState: obs.lifecycleState,
        lastObservedAt: obs.observedAt,
        confidence: obs.confidence,
        evidenceIds: obs.evidenceIds,
      });
    }

    const propDocRef = activeDb.collection('intelligence_properties').doc(propertyId);
    const existingSnap = await propDocRef.get();

    if (existingSnap && existingSnap.exists) {
      const data = typeof existingSnap.data === 'function' ? existingSnap.data() : existingSnap.data;
      await propDocRef.set(
        cleanUndefinedFields({
          ...data,
          buildingComponents,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
    }
  }
}

export const propertyLifecycleService = new PropertyLifecycleService();
