/**
 * AnyTrader V8.2 — Predictive Maintenance Intelligence Service
 * 
 * Provides:
 * - Evidence-backed Predictive Maintenance Engine (`MAINTENANCE_METHODOLOGY_VERSION = 'v8.2-maintenance-v1'`)
 * - Core Invariant: "PREDICTION IS AN INFERENCE, NOT AN OBSERVATION"
 * - Invariant: No Evidence = No Prediction (Rejects fabricated / unverified evidence)
 * - Append-only Immutable Historical Prediction Records (`property_maintenance_history`)
 * - Immutable Supersession Records (`property_maintenance_supersessions`)
 * - Authoritative Property & Job Lineage Validation (Job -> Property -> Component -> Evidence -> Prediction)
 * - AI Security Boundary & Non-Promotion Enforcement (AI candidates cannot self-promote)
 * - Cross-Property & Cross-Tenant Isolation
 * - Bounded Property-Scoped Queries (`propertyId` equality filter + limit)
 * - Atomic Firestore Transaction Concurrency & Idempotency
 * - Retracted Supporting Evidence Exclusion from Active Projection
 */

import { computeSha256 } from './provenance';
import { getGlobalIntelligenceDb } from './immutableStore';
import { resolveAuthoritativeJobPropertyId } from './jobIntelligence';
import { evidenceRegistry } from './evidenceRegistry';
import { validateComponentType, normalizeComponentType, EvidenceStatus } from './propertyOntology';
import { cleanUndefinedFields, getEvidenceFromFirestore } from './evidence';
import { intelligenceTaskQueue } from './intelligenceTaskQueue';
import {
  PredictiveMaintenanceAssessment,
  RecordPredictiveMaintenanceInput,
  PredictiveMaintenanceSupersession,
  PropertyMaintenanceProjection,
  PredictiveMaintenanceType,
  PredictiveMaintenanceStatus,
  SeverityLevel,
  ConfidenceScores,
  Provenance,
  IntelligenceTask,
} from './types';

export const MAINTENANCE_METHODOLOGY_VERSION = 'v8.2-maintenance-v1';

/**
 * Severity base weights for deterministic maintenance likelihood calculations
 */
const SEVERITY_BASE_WEIGHTS: Record<SeverityLevel, number> = {
  low: 0.25,
  medium: 0.55,
  high: 0.85,
  critical: 0.95,
};

/**
 * Validates ISO date format (YYYY-MM-DD or ISO 8601 string)
 */
export function isValidIsoDate(dateStr: string): boolean {
  if (typeof dateStr !== 'string' || dateStr.trim().length === 0) {
    return false;
  }
  const timestamp = Date.parse(dateStr);
  return !isNaN(timestamp);
}

/**
 * Calculates a deterministic, versioned maintenance forecast (likelihood & severity)
 * based on severity level, confidence score, and evidence quality.
 */
export function calculateDeterministicMaintenanceForecast(
  severity: SeverityLevel = 'medium',
  confidenceScore: number = 0.8,
  evidenceQuality: number = 0.8
): { likelihood: number; severity: SeverityLevel } {
  const baseWeight = SEVERITY_BASE_WEIGHTS[severity] ?? 0.55;
  const confFactor = Math.max(0.1, Math.min(1.0, confidenceScore));
  const qualFactor = Math.max(0.1, Math.min(1.0, evidenceQuality));

  // Weighted formula: baseWeight * (0.6 * confidence + 0.4 * evidenceQuality)
  const adjusted = baseWeight * (0.6 * confFactor + 0.4 * qualFactor);
  const likelihood = Math.min(1.0, Math.max(0.05, Math.round(adjusted * 100) / 100));

  return { likelihood, severity };
}

export class PredictiveMaintenanceService {
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
   * Records a new evidence-backed predictive maintenance assessment with fail-closed security.
   */
  public async recordMaintenancePrediction(
    input: RecordPredictiveMaintenanceInput,
    options?: { firestoreDb?: any; isVerifiedServerAction?: boolean }
  ): Promise<PredictiveMaintenanceAssessment> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();

    if (!activeDb) {
      throw new Error('[PredictiveMaintenance Error] Firestore database reference required for predictive maintenance');
    }

    // 1. Basic Parameter Validation
    if (!input.propertyId || typeof input.propertyId !== 'string' || input.propertyId.trim().length === 0) {
      throw new Error('[PredictiveMaintenance Error] Valid propertyId is required');
    }
    if (!input.componentType || typeof input.componentType !== 'string' || input.componentType.trim().length === 0) {
      throw new Error('[PredictiveMaintenance Error] Valid componentType is required');
    }
    const validPredictionTypes: PredictiveMaintenanceType[] = [
      'inspection_due',
      'maintenance_due',
      'replacement_likelihood',
      'condition_review',
    ];
    if (!input.predictionType || !validPredictionTypes.includes(input.predictionType)) {
      throw new Error(`[PredictiveMaintenance Error] Valid predictionType is required (${validPredictionTypes.join(', ')})`);
    }
    if (!isValidIsoDate(input.forecastStart) || !isValidIsoDate(input.forecastEnd)) {
      throw new Error('[PredictiveMaintenance Error] Forecast window requires valid ISO date strings (forecastStart, forecastEnd)');
    }
    if (new Date(input.forecastStart).getTime() > new Date(input.forecastEnd).getTime()) {
      throw new Error('[PredictiveMaintenance Error] forecastStart cannot be after forecastEnd');
    }
    if (!input.rationale || typeof input.rationale !== 'string' || input.rationale.trim().length === 0) {
      throw new Error('[PredictiveMaintenance Error] Valid rationale is required');
    }

    // 2. Authoritative Property Existence Check (Fail Closed)
    const propDoc = await activeDb.collection('properties').doc(input.propertyId).get();
    if (!propDoc || !propDoc.exists) {
      throw new Error(`[PredictiveMaintenance Violation] Property '${input.propertyId}' does not exist`);
    }
    const propData = typeof propDoc.data === 'function' ? propDoc.data() : propDoc.data;
    const authoritativeTenant = propData?.tenantId ?? propData?.landlordId ?? propData?.ownerId;

    // 3. CORE INVARIANT: NO EVIDENCE = NO PREDICTION
    if (!input.evidenceIds || !Array.isArray(input.evidenceIds) || input.evidenceIds.length === 0) {
      throw new Error('[PredictiveMaintenance Violation] Prediction requires supporting evidence');
    }

    const cleanEvidenceIds = input.evidenceIds.filter((id) => typeof id === 'string' && id.trim().length > 0);
    if (cleanEvidenceIds.length === 0) {
      throw new Error('[PredictiveMaintenance Violation] Prediction requires non-empty evidence IDs');
    }

    // 4. Cross-Tenant Contamination Check
    if (input.provenance?.tenantId && authoritativeTenant && input.provenance.tenantId !== authoritativeTenant) {
      throw new Error(
        `[CrossTenantContamination Violation] Tenant '${input.provenance.tenantId}' does not match property owner/tenant '${authoritativeTenant}'`
      );
    }

    // 5. Authoritative Job Lineage Verification
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

    // 6. Verify Authoritative Evidence Existence, Property Lineage, and Retraction Status
    let maxEvidenceQuality = 0.8;
    for (const evId of cleanEvidenceIds) {
      const registeredEv = await getEvidenceFromFirestore(activeDb, evId);
      if (!registeredEv) {
        // Direct Firestore fallback check in intelligence_evidence
        const evDoc = await activeDb.collection('intelligence_evidence').doc(evId).get();
        if (!evDoc || !evDoc.exists) {
          throw new Error(
            `[PredictiveMaintenance Violation] Fabricated or non-existent evidence ID: Referenced evidence ID '${evId}' does not exist`
          );
        }
        const evData = typeof evDoc.data === 'function' ? evDoc.data() : evDoc.data;
        const evPropertyId = evData?.sourceReference?.propertyId ?? evData?.propertyId ?? evData?.aggregateId;
        const evTenantId = evData?.provenance?.tenantId ?? evData?.tenantId;

        if (evTenantId && authoritativeTenant && evTenantId !== authoritativeTenant) {
          throw new Error(`[CrossTenantContamination Violation] Evidence '${evId}' belongs to tenant '${evTenantId}'`);
        }

        const evJobId = evData?.sourceJobId ?? evData?.sourceReference?.jobId;
        const isJobMatch = Boolean(input.sourceJobId && evJobId && input.sourceJobId === evJobId);
        if (evPropertyId && evPropertyId !== input.propertyId && !isJobMatch) {
          throw new Error(
            `[PredictiveMaintenance Violation] Cross-property lineage violation: Evidence '${evId}' belongs to property '${evPropertyId}', not '${input.propertyId}'`
          );
        }

        if (evData?.status === 'retracted' || evData?.status === 'rejected' || evData?.integrityStatus === 'retracted') {
          throw new Error(`[PredictiveMaintenance Violation] Cannot create prediction based on retracted evidence '${evId}'`);
        }
      } else {
        const evPropertyId = registeredEv.sourceReference?.propertyId ?? registeredEv.aggregateId;
        const evJobId = registeredEv.sourceReference?.jobId;
        const isJobMatch = Boolean(input.sourceJobId && evJobId && input.sourceJobId === evJobId);
        if (evPropertyId && evPropertyId !== input.propertyId && !isJobMatch) {
          throw new Error(
            `[PredictiveMaintenance Violation] Cross-property lineage violation: Evidence '${evId}' belongs to property '${evPropertyId}', not '${input.propertyId}'`
          );
        }
        const evStatus = (registeredEv as any).status || (registeredEv.integrityStatus as string);
        if (evStatus === 'retracted' || evStatus === 'rejected') {
          throw new Error(`[PredictiveMaintenance Violation] Cannot create prediction based on retracted evidence '${evId}'`);
        }
        if (typeof registeredEv.evidenceQuality === 'number') {
          maxEvidenceQuality = Math.max(maxEvidenceQuality, registeredEv.evidenceQuality);
        }
      }
    }

    // 7. Component Type Ontology Normalization & Verification
    const componentType = validateComponentType(input.componentType);

    // 8. Supporting Condition Lineage Verification
    if (input.supportingConditionIds && input.supportingConditionIds.length > 0) {
      for (const condId of input.supportingConditionIds) {
        const condDoc = await activeDb.collection('property_condition_history').doc(condId).get();
        if (!condDoc || !condDoc.exists) {
          throw new Error(`[PredictiveMaintenance Violation] Supporting condition ID '${condId}' does not exist`);
        }
        const condData = typeof condDoc.data === 'function' ? condDoc.data() : condDoc.data;
        if (condData?.propertyId && condData.propertyId !== input.propertyId) {
          throw new Error(
            `[PredictiveMaintenance Violation] Supporting condition '${condId}' belongs to property '${condData.propertyId}', not '${input.propertyId}'`
          );
        }
      }
    }

    // 9. Supporting Risk Lineage & Retraction Verification (Vector R)
    if (input.supportingRiskIds && input.supportingRiskIds.length > 0) {
      for (const riskId of input.supportingRiskIds) {
        const riskDoc = await activeDb.collection('property_risk_history').doc(riskId).get();
        if (!riskDoc || !riskDoc.exists) {
          throw new Error(`[PredictiveMaintenance Violation] Supporting risk ID '${riskId}' does not exist`);
        }
        const riskData = typeof riskDoc.data === 'function' ? riskDoc.data() : riskDoc.data;
        if (riskData?.propertyId && riskData.propertyId !== input.propertyId) {
          throw new Error(
            `[PredictiveMaintenance Violation] Supporting risk '${riskId}' belongs to property '${riskData.propertyId}', not '${input.propertyId}'`
          );
        }
        // Check if retracted in property_risk_retractions
        const retractionSnap = await activeDb
          .collection('property_risk_retractions')
          .doc(`retract_${riskId}`)
          .get();
        if (retractionSnap && retractionSnap.exists) {
          throw new Error(`[PredictiveMaintenance Violation] Supporting risk '${riskId}' is retracted`);
        }
      }
    }

    // 10. Completed Job != Automatic Repair Guardrail (Vector O & P)
    if (input.metadata?.assertsRepair === true && !options?.isVerifiedServerAction) {
      const validOutcomeTypes = [
        'completion_certificate',
        'outcome_verification',
        'work_completion',
        'repair_certificate',
        'invoice_receipt',
      ];
      let hasRegisteredOutcome = false;
      for (const evId of cleanEvidenceIds) {
        const evDoc = await activeDb.collection('intelligence_evidence').doc(evId).get();
        if (evDoc && evDoc.exists) {
          const evData = typeof evDoc.data === 'function' ? evDoc.data() : evDoc.data;
          if (validOutcomeTypes.includes(evData?.evidenceType || evData?.type)) {
            hasRegisteredOutcome = true;
            break;
          }
        }
      }
      if (!hasRegisteredOutcome && input.metadata?.isOutcomeVerified !== true) {
        throw new Error(
          '[PredictiveMaintenance Violation] Completed job requires supporting outcome evidence to establish component repair/replacement'
        );
      }
    }

    // 11. AI Boundary & Non-Promotion Enforcement (Vector H & I)
    const isAiOrigin = Boolean(
      input.provenance?.origin?.toLowerCase().includes('ai') ||
      input.provenance?.source?.toLowerCase().includes('ai') ||
      input.sourceType === 'ai_inference' ||
      (input.status as string) === 'derived'
    );

    // Vector H: AI cannot claim prediction is an observed condition
    if (input.metadata?.asObservation === true || input.metadata?.targetCollection === 'observedConditions') {
      throw new Error('[AIPredictionObservationConfusion Violation] Prediction cannot be asserted as an observed condition');
    }

    // Vector I: AI cannot self-verify
    let finalStatus: PredictiveMaintenanceStatus = input.status || 'predicted';
    if (isAiOrigin && options?.isVerifiedServerAction !== true) {
      if ((input.status as string) === 'verified') {
        finalStatus = 'predicted'; // Strip unverified self-promotion
      }
    }

    // 12. Severity Normalization
    const severity: SeverityLevel = input.severity && ['low', 'medium', 'high', 'critical'].includes(input.severity)
      ? input.severity
      : 'medium';

    // 13. Confidence Structure Normalization
    const confOverall = typeof input.confidence === 'number'
      ? input.confidence
      : (input.confidence?.overall ?? 0.8);

    const confidence: ConfidenceScores = {
      overall: Math.max(0.0, Math.min(1.0, confOverall)),
      extraction: typeof input.confidence === 'object' && typeof input.confidence.extraction === 'number' ? input.confidence.extraction : 0.8,
      evidenceQuality: maxEvidenceQuality,
      classification: typeof input.confidence === 'object' && typeof input.confidence.classification === 'number' ? input.confidence.classification : 0.8,
      temporalFreshness: typeof input.confidence === 'object' && typeof input.confidence.temporalFreshness === 'number' ? input.confidence.temporalFreshness : 1.0,
      method: isAiOrigin ? 'model_validated' : 'deterministic_heuristic',
    };

    // 14. Deterministic Likelihood Derivation
    let likelihood = input.likelihood;
    if (typeof likelihood !== 'number') {
      const forecastResult = calculateDeterministicMaintenanceForecast(severity, confidence.overall, confidence.evidenceQuality);
      likelihood = forecastResult.likelihood;
    } else {
      likelihood = Math.max(0.0, Math.min(1.0, likelihood));
    }

    // 15. Content Hash & Deterministic ID
    // Note: generatedAt is strictly EXCLUDED from payloadForHash to guarantee semantic idempotency.
    const sortedEvIds = [...cleanEvidenceIds].sort();
    const sortedCondIds = [...(input.supportingConditionIds || [])].sort();
    const sortedRiskIds = [...(input.supportingRiskIds || [])].sort();
    const sortedJobIds = [...(input.supportingJobIds || [])].sort();
    const nowIso = new Date().toISOString();

    const payloadForHash = {
      propertyId: input.propertyId,
      componentType,
      predictionType: input.predictionType,
      forecastStart: input.forecastStart,
      forecastEnd: input.forecastEnd,
      severity,
      evidenceIds: sortedEvIds,
      supportingConditionIds: sortedCondIds,
      supportingRiskIds: sortedRiskIds,
      methodologyVersion: MAINTENANCE_METHODOLOGY_VERSION,
    };
    const contentHash = computeSha256(JSON.stringify(payloadForHash));
    const maintenanceId = `pm_${input.propertyId}_${contentHash.slice(0, 16)}`;

    // 16. Construct Complete Predictive Maintenance Record
    const provenance: Provenance = {
      origin: input.provenance?.origin || (isAiOrigin ? 'ai_inference' : 'deterministic_engine'),
      source: input.provenance?.source || input.sourceType || 'system',
      evidenceIds: sortedEvIds,
      pipelineVersion: input.provenance?.pipelineVersion || 'v8.2',
      modelVersion: input.provenance?.modelVersion || 'gemini-3.1-pro-preview',
      promptVersion: input.provenance?.promptVersion || 'v1.0',
      generatedAt: input.provenance?.generatedAt || nowIso,
      tenantId: input.provenance?.tenantId || authoritativeTenant,
      contentHash,
    };

    const maintenanceAssessment: PredictiveMaintenanceAssessment = {
      maintenanceId,
      propertyId: input.propertyId,
      componentType,
      predictionType: input.predictionType,
      forecastStart: input.forecastStart,
      forecastEnd: input.forecastEnd,
      likelihood,
      severity,
      rationale: input.rationale,
      evidenceIds: sortedEvIds,
      supportingConditionIds: sortedCondIds,
      supportingRiskIds: sortedRiskIds,
      supportingJobIds: sortedJobIds,
      sourceJobId: input.sourceJobId,
      sourceType: input.sourceType || 'manual',
      sourceId: input.sourceId,
      confidence,
      provenance,
      methodologyVersion: MAINTENANCE_METHODOLOGY_VERSION,
      generatedAt: nowIso,
      status: finalStatus,
      contentHash,
      metadata: input.metadata || {},
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 17. Transactional Atomic Firestore Storage & Idempotency
    const cleanAssessmentRecord = cleanUndefinedFields(maintenanceAssessment);

    await activeDb.runTransaction(async (transaction: any) => {
      const historyRef = activeDb.collection('property_maintenance_history').doc(maintenanceId);
      const existingDoc = await transaction.get(historyRef);

      if (existingDoc && existingDoc.exists) {
        const existingData = typeof existingDoc.data === 'function' ? existingDoc.data() : existingDoc.data;
        if (existingData?.contentHash && existingData.contentHash !== contentHash) {
          throw new Error(`[PredictiveMaintenance Violation] Conflicting maintenance prediction content for ID '${maintenanceId}'`);
        }
        // Idempotent hit: return existing record without overwriting
        return;
      }

      // Write immutable append-only record
      transaction.set(historyRef, cleanAssessmentRecord);
    });

    // 18. Update Property Current Projection
    await this.updateCurrentPropertyMaintenanceProjection(input.propertyId, activeDb);

    return maintenanceAssessment;
  }

  /**
   * Supersedes an existing maintenance prediction via an append-only supersession record
   * without mutating the original historical prediction document.
   */
  public async supersedeMaintenancePrediction(
    maintenanceId: string,
    reason: string,
    options?: { firestoreDb?: any; propertyId?: string; supersededByMaintenanceId?: string; provenance?: Provenance }
  ): Promise<PredictiveMaintenanceSupersession> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) {
      throw new Error('[PredictiveMaintenance Error] Firestore database reference required for supersession');
    }

    if (!maintenanceId || typeof maintenanceId !== 'string' || maintenanceId.trim().length === 0) {
      throw new Error('[PredictiveMaintenance Error] Valid maintenanceId is required for supersession');
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new Error('[PredictiveMaintenance Error] Valid supersession reason is required');
    }

    // 1. Fetch original historical maintenance assessment record (must exist)
    const historyRef = activeDb.collection('property_maintenance_history').doc(maintenanceId);
    const docSnap = await historyRef.get();
    if (!docSnap || !docSnap.exists) {
      throw new Error(`[PredictiveMaintenance Error] Maintenance prediction '${maintenanceId}' not found`);
    }

    const maintenanceData = typeof docSnap.data === 'function' ? docSnap.data() : docSnap.data;
    const predictionPropertyId = maintenanceData?.propertyId;

    if (!predictionPropertyId) {
      throw new Error(`[PredictiveMaintenance Error] Property ID not found on maintenance prediction '${maintenanceId}'`);
    }

    // 2. Reject Cross-Property Supersession
    if (options?.propertyId && options.propertyId !== predictionPropertyId) {
      throw new Error(
        `[PredictiveMaintenance Violation] Supersession property '${options.propertyId}' does not match prediction property '${predictionPropertyId}'`
      );
    }

    // 3. Compute Deterministic Identity & Content Hash for Supersession Event
    const nowIso = new Date().toISOString();
    const supersessionPayloadForHash = {
      maintenanceId,
      propertyId: predictionPropertyId,
      reason,
      supersededByMaintenanceId: options?.supersededByMaintenanceId,
      methodologyVersion: MAINTENANCE_METHODOLOGY_VERSION,
    };
    const contentHash = computeSha256(JSON.stringify(supersessionPayloadForHash));
    const supersessionId = `supersede_${maintenanceId}`;

    const supersessionRecord: PredictiveMaintenanceSupersession = {
      supersessionId,
      maintenanceId,
      propertyId: predictionPropertyId,
      reason,
      supersededByMaintenanceId: options?.supersededByMaintenanceId,
      supersededAt: nowIso,
      provenance: options?.provenance || {
        origin: 'manual_supersession',
        source: 'system',
        generatedAt: nowIso,
        tenantId: maintenanceData.provenance?.tenantId,
      },
      methodologyVersion: MAINTENANCE_METHODOLOGY_VERSION,
      contentHash,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 4. Transactional Atomic Firestore Storage & Idempotency
    const cleanSupersessionRecord = cleanUndefinedFields(supersessionRecord);

    await activeDb.runTransaction(async (transaction: any) => {
      const supersessionRef = activeDb.collection('property_maintenance_supersessions').doc(supersessionId);
      const existingDoc = await transaction.get(supersessionRef);

      if (existingDoc && existingDoc.exists) {
        const existingData = typeof existingDoc.data === 'function' ? existingDoc.data() : existingDoc.data;
        if (existingData?.contentHash && existingData.contentHash !== contentHash) {
          throw new Error(
            `[PredictiveMaintenance Violation] Conflicting supersession content for maintenance ID '${maintenanceId}'`
          );
        }
        return;
      }

      // Write immutable append-only supersession record
      transaction.set(supersessionRef, cleanSupersessionRecord);
    });

    // NOTE: historyRef (the original assessment in property_maintenance_history)
    // is intentionally NOT modified. It remains strictly immutable and unchanged.

    // 5. Recalculate Current Property Maintenance Projection (excluding superseded items)
    await this.updateCurrentPropertyMaintenanceProjection(predictionPropertyId, activeDb);

    return supersessionRecord;
  }

  /**
   * Retrieves property maintenance supersessions scoped to propertyId.
   */
  public async getPropertyMaintenanceSupersessions(
    propertyId: string,
    options?: { firestoreDb?: any }
  ): Promise<PredictiveMaintenanceSupersession[]> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) {
      throw new Error('[PredictiveMaintenance Error] Firestore database reference required for supersessions');
    }

    if (!propertyId || typeof propertyId !== 'string') {
      throw new Error('[PredictiveMaintenance Error] Valid propertyId is required');
    }

    const snapshot = await activeDb
      .collection('property_maintenance_supersessions')
      .where('propertyId', '==', propertyId)
      .get();

    if (!snapshot || snapshot.empty) {
      return [];
    }

    const results: PredictiveMaintenanceSupersession[] = [];
    const docs = snapshot.docs || [];
    for (const doc of docs) {
      const data = typeof doc.data === 'function' ? doc.data() : doc.data;
      if (data) {
        results.push(data as PredictiveMaintenanceSupersession);
      }
    }

    return results;
  }

  /**
   * Database-bounded query to retrieve property maintenance history scoped to propertyId.
   */
  public async getPropertyMaintenanceHistory(
    propertyId: string,
    options?: { limit?: number; firestoreDb?: any }
  ): Promise<PredictiveMaintenanceAssessment[]> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) {
      throw new Error('[PredictiveMaintenance Error] Firestore database reference required for maintenance history');
    }

    if (!propertyId || typeof propertyId !== 'string') {
      throw new Error('[PredictiveMaintenance Error] Valid propertyId is required');
    }

    const limitVal = Math.min(100, Math.max(1, options?.limit ?? 50));

    // Property-scoped database-bounded query
    const snapshot = await activeDb
      .collection('property_maintenance_history')
      .where('propertyId', '==', propertyId)
      .orderBy('forecastStart', 'desc')
      .limit(limitVal)
      .get();

    if (!snapshot || snapshot.empty) {
      return [];
    }

    const results: PredictiveMaintenanceAssessment[] = [];
    const docs = snapshot.docs || [];
    for (const doc of docs) {
      const data = typeof doc.data === 'function' ? doc.data() : doc.data;
      if (data) {
        results.push(data as PredictiveMaintenanceAssessment);
      }
    }

    return results;
  }

  /**
   * Recalculates and updates current property maintenance projection under `/properties/{propertyId}`.
   */
  public async updateCurrentPropertyMaintenanceProjection(
    propertyId: string,
    firestoreDb?: any
  ): Promise<PropertyMaintenanceProjection> {
    const activeDb = firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) {
      throw new Error('[PredictiveMaintenance Error] Firestore database reference required for projection update');
    }

    // 1. Fetch supersessions for this property
    const supersessionsSnap = await activeDb
      .collection('property_maintenance_supersessions')
      .where('propertyId', '==', propertyId)
      .get();

    const supersededMaintenanceIds = new Set<string>();
    if (supersessionsSnap && !supersessionsSnap.empty) {
      const docs = supersessionsSnap.docs || [];
      for (const doc of docs) {
        const sData = typeof doc.data === 'function' ? doc.data() : doc.data;
        if (sData?.maintenanceId) {
          supersededMaintenanceIds.add(sData.maintenanceId);
        }
      }
    }

    // 2. Fetch risk retractions for this property (Vector R)
    const riskRetractionsSnap = await activeDb
      .collection('property_risk_retractions')
      .where('propertyId', '==', propertyId)
      .get();

    const retractedRiskIds = new Set<string>();
    if (riskRetractionsSnap && !riskRetractionsSnap.empty) {
      const docs = riskRetractionsSnap.docs || [];
      for (const doc of docs) {
        const rData = typeof doc.data === 'function' ? doc.data() : doc.data;
        if (rData?.riskId) {
          retractedRiskIds.add(rData.riskId);
        }
      }
    }

    // 3. Query historical predictions for this property
    const history = await this.getPropertyMaintenanceHistory(propertyId, { limit: 100, firestoreDb: activeDb });

    // 4. Filter active non-superseded, non-retracted predictions
    const activePredictions = history.filter((item) => {
      if (supersededMaintenanceIds.has(item.maintenanceId)) return false;
      if (item.status === 'superseded' || item.status === 'retracted') return false;
      // Vector R: If any supporting risk ID is retracted, active prediction cannot silently remain
      if (item.supportingRiskIds && item.supportingRiskIds.some((id) => retractedRiskIds.has(id))) {
        return false;
      }
      return true;
    });

    // 5. Build component forecasts
    const componentForecasts: Record<
      string,
      {
        nextInspectionDate?: string;
        nextMaintenanceDate?: string;
        predictionCount: number;
        highestSeverity: SeverityLevel;
      }
    > = {};

    for (const item of activePredictions) {
      const comp = item.componentType;
      if (!componentForecasts[comp]) {
        componentForecasts[comp] = {
          predictionCount: 0,
          highestSeverity: 'low',
        };
      }
      componentForecasts[comp].predictionCount += 1;

      if (SEVERITY_BASE_WEIGHTS[item.severity] > SEVERITY_BASE_WEIGHTS[componentForecasts[comp].highestSeverity]) {
        componentForecasts[comp].highestSeverity = item.severity;
      }

      if (item.predictionType === 'inspection_due' || item.predictionType === 'condition_review') {
        if (!componentForecasts[comp].nextInspectionDate || item.forecastStart < componentForecasts[comp].nextInspectionDate) {
          componentForecasts[comp].nextInspectionDate = item.forecastStart;
        }
      }

      if (item.predictionType === 'maintenance_due' || item.predictionType === 'replacement_likelihood') {
        if (!componentForecasts[comp].nextMaintenanceDate || item.forecastStart < componentForecasts[comp].nextMaintenanceDate) {
          componentForecasts[comp].nextMaintenanceDate = item.forecastStart;
        }
      }
    }

    const projection: PropertyMaintenanceProjection = {
      activePredictions,
      componentForecasts,
      methodologyVersion: MAINTENANCE_METHODOLOGY_VERSION,
      updatedAt: new Date().toISOString(),
    };

    const cleanProjection = cleanUndefinedFields(projection);

    // Update property document projection
    const propRef = activeDb.collection('properties').doc(propertyId);
    await propRef.set(
      {
        intelligence: {
          maintenanceProjection: cleanProjection,
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return projection;
  }
}

export const predictiveMaintenanceService = new PredictiveMaintenanceService();

/**
 * Production Task Queue entry point for triggering Predictive Maintenance
 */
export async function enqueuePredictiveMaintenanceTask(
  propertyId: string,
  input: Partial<RecordPredictiveMaintenanceInput> & { rawCandidate?: any; db?: any },
  options?: { firestoreDb?: any; idempotencyKey?: string }
): Promise<IntelligenceTask> {
  const activeDb = options?.firestoreDb || input.db || getGlobalIntelligenceDb();
  if (activeDb) {
    intelligenceTaskQueue.setFirestoreDb(activeDb);
  }
  const idempKey = options?.idempotencyKey || `idem_pm_${propertyId}_${input.componentType || 'roof'}_${computeSha256(JSON.stringify(input)).slice(0, 16)}`;
  return intelligenceTaskQueue.enqueueTaskAsync(
    'predictive_maintenance',
    'property',
    propertyId,
    idempKey,
    {
      ...input,
      propertyId,
      db: activeDb,
    }
  );
}
