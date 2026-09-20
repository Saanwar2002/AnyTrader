/**
 * AnyTrader V8.2 — Property Risk Intelligence Service
 * 
 * Provides:
 * - Evidence-backed Property Risk Assessment Engine & Scoring (`RISK_METHODOLOGY_VERSION = 'v8.2-risk-v1'`)
 * - Invariant: No Evidence = No Risk Assertion
 * - Append-only Immutable Historical Risk Records (`property_risk_history`)
 * - Authoritative Property & Job Lineage Validation (Job -> Property -> Evidence -> Risk)
 * - AI Security Boundary & Non-Promotion Enforcement (AI candidates cannot self-promote)
 * - Cross-Property & Cross-Tenant Isolation
 * - Bounded Property-Scoped Queries (`propertyId` equality filter + limit)
 * - Atomic Firestore Transaction Concurrency & Idempotency
 * - Evidence Correction / Retraction without deleting immutable history
 */

import { computeSha256 } from './provenance';
import { getGlobalIntelligenceDb } from './immutableStore';
import { resolveAuthoritativeJobPropertyId } from './jobIntelligence';
import { evidenceRegistry } from './evidenceRegistry';
import { validateComponentType, normalizeComponentType, EvidenceStatus } from './propertyOntology';
import { cleanUndefinedFields, getEvidenceFromFirestore } from './evidence';
import {
  PropertyRiskAssessment,
  RecordPropertyRiskInput,
  PropertyRiskProjection,
  SeverityLevel,
  ConfidenceScores,
  Provenance,
} from './types';

export const RISK_METHODOLOGY_VERSION = 'v8.2-risk-v1';

/**
 * Severity base weights for deterministic risk scoring
 */
const SEVERITY_BASE_WEIGHTS: Record<SeverityLevel, number> = {
  low: 15,
  medium: 40,
  high: 70,
  critical: 90,
};

/**
 * Calculates a deterministic, versioned risk score (0-100) based on severity, confidence, and evidence quality.
 */
export function calculateDeterministicRiskScore(
  severity: SeverityLevel,
  confidenceScore: number = 0.8,
  evidenceQuality: number = 0.8
): number {
  const baseWeight = SEVERITY_BASE_WEIGHTS[severity] ?? 15;
  const confFactor = Math.max(0.1, Math.min(1.0, confidenceScore));
  const qualFactor = Math.max(0.1, Math.min(1.0, evidenceQuality));

  // Weighted formula: baseWeight * (0.6 * confidence + 0.4 * evidenceQuality)
  const adjusted = baseWeight * (0.6 * confFactor + 0.4 * qualFactor);
  return Math.min(100, Math.max(0, Math.round(adjusted)));
}

export class PropertyRiskService {
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
   * Records a new evidence-backed property risk assessment with fail-closed security.
   */
  public async recordRiskAssessment(
    input: RecordPropertyRiskInput,
    options?: { firestoreDb?: any; isVerifiedServerAction?: boolean }
  ): Promise<PropertyRiskAssessment> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();

    if (!activeDb) {
      throw new Error('[PropertyRisk Error] Firestore database reference required for risk assessment');
    }

    // 1. Basic Parameter Validation
    if (!input.propertyId || typeof input.propertyId !== 'string' || input.propertyId.trim().length === 0) {
      throw new Error('[PropertyRisk Error] Valid propertyId is required');
    }
    if (!input.riskType || typeof input.riskType !== 'string' || input.riskType.trim().length === 0) {
      throw new Error('[PropertyRisk Error] Valid riskType is required');
    }
    if (!input.description || typeof input.description !== 'string' || input.description.trim().length === 0) {
      throw new Error('[PropertyRisk Error] Valid description is required');
    }

    // 2. Authoritative Property Existence Check (Fail Closed)
    const propDoc = await activeDb.collection('properties').doc(input.propertyId).get();
    if (!propDoc || !propDoc.exists) {
      throw new Error(`[PropertyRisk Violation] Property '${input.propertyId}' does not exist`);
    }
    const propData = typeof propDoc.data === 'function' ? propDoc.data() : propDoc.data;
    const authoritativeTenant = propData?.tenantId ?? propData?.landlordId ?? propData?.ownerId;

    // 3. CORE INVARIANT: NO EVIDENCE = NO RISK ASSERTION
    if (!input.evidenceIds || !Array.isArray(input.evidenceIds) || input.evidenceIds.length === 0) {
      throw new Error('[PropertyRisk Violation] Risk assessment requires source evidence');
    }

    // Filter and sanitize evidence IDs
    const cleanEvidenceIds = input.evidenceIds.filter(id => typeof id === 'string' && id.trim().length > 0);
    if (cleanEvidenceIds.length === 0) {
      throw new Error('[PropertyRisk Violation] Risk assessment requires non-empty evidence IDs');
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

    // 6. Verify Authoritative Evidence Existence & Property Boundary
    let maxEvidenceQuality = 0.8;
    for (const evId of cleanEvidenceIds) {
      const registeredEv = await getEvidenceFromFirestore(activeDb, evId);
      if (!registeredEv) {
        // Direct Firestore fallback check for intelligence_evidence collection
        const evDoc = await activeDb.collection('intelligence_evidence').doc(evId).get();
        if (!evDoc || !evDoc.exists) {
          throw new Error(`[PropertyRisk Violation] Referenced evidence ID '${evId}' does not exist`);
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
          throw new Error(`[PropertyRisk Violation] Evidence '${evId}' belongs to property '${evPropertyId}', not '${input.propertyId}'`);
        }
      } else {
        const evPropertyId = registeredEv.sourceReference?.propertyId ?? registeredEv.aggregateId;
        const evJobId = registeredEv.sourceReference?.jobId;
        const isJobMatch = Boolean(input.sourceJobId && evJobId && input.sourceJobId === evJobId);
        if (evPropertyId && evPropertyId !== input.propertyId && !isJobMatch) {
          throw new Error(`[PropertyRisk Violation] Evidence '${evId}' belongs to property '${evPropertyId}', not '${input.propertyId}'`);
        }
        if (typeof registeredEv.evidenceQuality === 'number') {
          maxEvidenceQuality = Math.max(maxEvidenceQuality, registeredEv.evidenceQuality);
        }
      }
    }

    // 7. Component Type Normalization
    const componentType = input.componentType ? normalizeComponentType(input.componentType) : undefined;

    // 8. Severity Normalization
    const severity: SeverityLevel = input.severity && ['low', 'medium', 'high', 'critical'].includes(input.severity)
      ? input.severity
      : 'medium';

    // 9. AI Boundary Enforcement
    const isAiOrigin = Boolean(
      input.provenance?.origin?.toLowerCase().includes('ai') ||
      input.provenance?.source?.toLowerCase().includes('ai') ||
      input.sourceType === 'ai_inference' ||
      input.status === 'derived'
    );

    let finalStatus: EvidenceStatus | 'retracted' = input.status || 'derived';
    if (isAiOrigin && options?.isVerifiedServerAction !== true) {
      if (input.status === 'verified') {
        finalStatus = 'derived'; // Strip unverified self-promotion
      }
    }

    // 10. Confidence Structure Normalization
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

    // 11. Deterministic Score Calculation
    const score = calculateDeterministicRiskScore(severity, confidence.overall, confidence.evidenceQuality);

    // 12. Content Hash & Deterministic ID
    const sortedEvIds = [...cleanEvidenceIds].sort();
    const nowIso = new Date().toISOString();
    const payloadForHash = {
      propertyId: input.propertyId,
      componentType: componentType || 'unspecified',
      riskType: input.riskType,
      description: input.description,
      severity,
      evidenceIds: sortedEvIds,
      methodologyVersion: RISK_METHODOLOGY_VERSION,
    };
    const contentHash = computeSha256(JSON.stringify(payloadForHash));
    const riskId = `pr_${input.propertyId}_${contentHash.slice(0, 16)}`;

    // 13. Construct Complete Risk Assessment
    const provenance: Provenance = {
      origin: input.provenance?.origin || (isAiOrigin ? 'ai_inference' : 'manual_inspection'),
      source: input.provenance?.source || input.sourceType || 'system',
      evidenceIds: sortedEvIds,
      pipelineVersion: input.provenance?.pipelineVersion || 'v8.2',
      modelVersion: input.provenance?.modelVersion || 'gemini-3.1-pro-preview',
      promptVersion: input.provenance?.promptVersion || 'v1.0',
      generatedAt: input.provenance?.generatedAt || nowIso,
      tenantId: input.provenance?.tenantId || authoritativeTenant,
      contentHash,
    };

    const riskAssessment: PropertyRiskAssessment = {
      riskId,
      propertyId: input.propertyId,
      componentType,
      riskType: input.riskType,
      description: input.description,
      score,
      severity,
      evidenceIds: sortedEvIds,
      supportingObservationIds: input.supportingObservationIds || [],
      supportingConditionIds: input.supportingConditionIds || [],
      sourceJobId: input.sourceJobId,
      sourceType: input.sourceType || 'manual',
      sourceId: input.sourceId,
      confidence,
      provenance,
      methodologyVersion: RISK_METHODOLOGY_VERSION,
      generatedAt: nowIso,
      status: finalStatus,
      contentHash,
      metadata: input.metadata || {},
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 14. Transactional Atomic Firestore Storage & Idempotency
    const cleanAssessmentRecord = cleanUndefinedFields(riskAssessment);

    await activeDb.runTransaction(async (transaction: any) => {
      const historyRef = activeDb.collection('property_risk_history').doc(riskId);
      const existingDoc = await transaction.get(historyRef);

      if (existingDoc && existingDoc.exists) {
        const existingData = typeof existingDoc.data === 'function' ? existingDoc.data() : existingDoc.data;
        if (existingData?.contentHash && existingData.contentHash !== contentHash) {
          throw new Error(`[PropertyRisk Violation] Conflicting risk assessment content for ID '${riskId}'`);
        }
        // Idempotent hit: return without overwriting
        return;
      }

      // Write immutable append-only record
      transaction.set(historyRef, cleanAssessmentRecord);
    });

    // 15. Update Property Current Projection
    await this.updateCurrentPropertyRiskProjection(input.propertyId, activeDb);

    return riskAssessment;
  }

  /**
   * Retracts or corrects an existing risk assessment without deleting historical append-only records.
   */
  public async retractRiskAssessment(
    riskId: string,
    reason: string,
    options?: { firestoreDb?: any }
  ): Promise<void> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) {
      throw new Error('[PropertyRisk Error] Firestore database reference required for retraction');
    }

    const historyRef = activeDb.collection('property_risk_history').doc(riskId);
    const docSnap = await historyRef.get();
    if (!docSnap || !docSnap.exists) {
      throw new Error(`[PropertyRisk Error] Risk assessment '${riskId}' not found`);
    }

    const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap.data;
    const propertyId = data?.propertyId;

    await historyRef.update({
      status: 'retracted',
      retractedAt: new Date().toISOString(),
      retractionReason: reason,
      updatedAt: new Date().toISOString(),
    });

    if (propertyId) {
      await this.updateCurrentPropertyRiskProjection(propertyId, activeDb);
    }
  }

  /**
   * Database-bounded query to retrieve property risk history scoped to propertyId.
   */
  public async getPropertyRiskHistory(
    propertyId: string,
    options?: { limit?: number; firestoreDb?: any }
  ): Promise<PropertyRiskAssessment[]> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) {
      throw new Error('[PropertyRisk Error] Firestore database reference required for risk history');
    }

    if (!propertyId || typeof propertyId !== 'string') {
      throw new Error('[PropertyRisk Error] Valid propertyId is required');
    }

    const limitVal = Math.min(100, Math.max(1, options?.limit ?? 50));

    // Property-scoped database-bounded query
    const snapshot = await activeDb
      .collection('property_risk_history')
      .where('propertyId', '==', propertyId)
      .orderBy('generatedAt', 'desc')
      .limit(limitVal)
      .get();

    if (!snapshot || snapshot.empty) {
      return [];
    }

    const results: PropertyRiskAssessment[] = [];
    const docs = snapshot.docs || [];
    for (const doc of docs) {
      const data = typeof doc.data === 'function' ? doc.data() : doc.data;
      if (data) {
        results.push(data as PropertyRiskAssessment);
      }
    }

    return results;
  }

  /**
   * Recalculates and updates current property risk projection under `/properties/{propertyId}`.
   */
  public async updateCurrentPropertyRiskProjection(
    propertyId: string,
    firestoreDb?: any
  ): Promise<PropertyRiskProjection> {
    const activeDb = firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) {
      throw new Error('[PropertyRisk Error] Firestore database reference required for projection update');
    }

    // Query active non-retracted risk assessments for this property
    const history = await this.getPropertyRiskHistory(propertyId, { limit: 100, firestoreDb: activeDb });
    const activeAssessments = history.filter(item => item.status !== 'retracted' && item.status !== 'rejected');

    let overallRiskScore = 0;
    let primaryRiskSeverity: SeverityLevel = 'low';
    const categoryBreakdown: Record<string, { count: number; maxScore: number; severity: SeverityLevel }> = {};

    if (activeAssessments.length > 0) {
      let maxScore = 0;
      let totalWeightedScore = 0;

      for (const item of activeAssessments) {
        maxScore = Math.max(maxScore, item.score);
        totalWeightedScore += item.score;

        const cat = item.componentType || item.riskType || 'general';
        if (!categoryBreakdown[cat]) {
          categoryBreakdown[cat] = { count: 0, maxScore: 0, severity: 'low' };
        }
        categoryBreakdown[cat].count += 1;
        categoryBreakdown[cat].maxScore = Math.max(categoryBreakdown[cat].maxScore, item.score);
        if (SEVERITY_BASE_WEIGHTS[item.severity] > SEVERITY_BASE_WEIGHTS[categoryBreakdown[cat].severity]) {
          categoryBreakdown[cat].severity = item.severity;
        }

        if (SEVERITY_BASE_WEIGHTS[item.severity] > SEVERITY_BASE_WEIGHTS[primaryRiskSeverity]) {
          primaryRiskSeverity = item.severity;
        }
      }

      // Aggregate overall score: peak risk score weighted with active risk count factor
      const avgScore = totalWeightedScore / activeAssessments.length;
      overallRiskScore = Math.min(100, Math.round(maxScore * 0.7 + avgScore * 0.3));
    }

    const projection: PropertyRiskProjection = {
      overallRiskScore,
      primaryRiskSeverity,
      activeRiskAssessments: activeAssessments,
      riskCategoryBreakdown: categoryBreakdown,
      methodologyVersion: RISK_METHODOLOGY_VERSION,
      updatedAt: new Date().toISOString(),
    };

    const cleanProjection = cleanUndefinedFields(projection);

    // Update property document projection
    const propRef = activeDb.collection('properties').doc(propertyId);
    await propRef.set(
      {
        intelligence: {
          riskProjection: cleanProjection,
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return projection;
  }
}

export const propertyRiskService = new PropertyRiskService();
