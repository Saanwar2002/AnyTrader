/**
 * AnyTrader V8.2 — Property Passport Projection Service
 * 
 * Provides:
 * - Evidence-backed, Versioned Property Passport Projection (`PASSPORT_SCHEMA_VERSION = 'v8.2-passport-v1'`)
 * - Immutable Historical Snapshots (`property_passport_history/{snapshotId}`)
 * - Authoritative Current Projection (`property_passports/{propertyId}`)
 * - Multi-Source Aggregation: Components, Condition Lifecycle, Risk Intelligence, Predictive Maintenance, Verified Outcomes
 * - Strict Invariant: "Passport is a derived projection, NOT a new source of truth"
 * - Strict Invariant: "No Evidence = No Material Assertion"
 * - Strict Invariant: "No AI Self-Promotion" (AI-derived/unverified sources remain unverified)
 * - Strict Invariant: "No Demo/Synthetic Data"
 * - Bounded Property-Scoped Queries (`propertyId` equality filter + limit)
 * - Deterministic SHA-256 Content Hashing & Idempotency
 * - Cross-Property & Cross-Tenant Lineage Isolation
 */

import { computeSha256 } from './provenance';
import { getGlobalIntelligenceDb } from './immutableStore';
import { validateComponentType, normalizeComponentType } from './propertyOntology';
import { cleanUndefinedFields } from './evidence';
import { intelligenceTaskQueue } from './intelligenceTaskQueue';
import {
  IntelligenceTask,
  PropertyPassport,
  PropertyPassportSnapshot,
  PropertyPassportComponent,
  PropertyPassportConditionSummary,
  PropertyPassportRiskSummary,
  PropertyPassportMaintenanceSummary,
  PropertyPassportVerifiedOutcomeSummary,
  PropertyPassportProvenance,
  GeneratePropertyPassportInput,
  SeverityLevel,
  UrgencyLevel,
  ConfidenceScores,
  PassportVerificationStatus,
} from './types';

export const PASSPORT_SCHEMA_VERSION = 'v8.2-passport-v1';
export const PASSPORT_PIPELINE_VERSION = 'v8.2.0';
export const MAX_PASSPORT_HISTORY_QUERY_LIMIT = 100;

export class PropertyPassportService {
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
   * Generates or refreshes the authoritative Property Passport projection for a property.
   * Pulls from evidence-backed condition history, risk intelligence, predictive maintenance, and verified outcomes.
   */
  public async generatePropertyPassport(
    input: GeneratePropertyPassportInput,
    options?: { firestoreDb?: any; isVerifiedServerAction?: boolean }
  ): Promise<PropertyPassport> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();

    if (!activeDb) {
      throw new Error('[PropertyPassport Error] Firestore database reference required for property passport projection');
    }

    // 1. Basic Parameter Validation
    if (!input.propertyId || typeof input.propertyId !== 'string' || input.propertyId.trim().length === 0) {
      throw new Error('[PropertyPassport Error] Valid propertyId is required');
    }

    const propertyId = input.propertyId.trim();

    // 2. Authoritative Property Existence Check (Fail Closed)
    const propDoc = await activeDb.collection('properties').doc(propertyId).get();
    if (!propDoc || !propDoc.exists) {
      throw new Error(`[PropertyPassport Violation] Property '${propertyId}' does not exist`);
    }
    const propData = typeof propDoc.data === 'function' ? propDoc.data() : propDoc.data;
    const authoritativeTenant = propData?.tenantId ?? propData?.landlordId ?? propData?.ownerId;

    // 3. Cross-Tenant Contamination Check
    if (input.provenance?.tenantId && authoritativeTenant && input.provenance.tenantId !== authoritativeTenant) {
      throw new Error(
        `[CrossTenantContamination Violation] Tenant '${input.provenance.tenantId}' does not match property owner/tenant '${authoritativeTenant}'`
      );
    }

    const allSourceRecordIds = new Set<string>();
    const allEvidenceIds = new Set<string>();
    const sourceCollections = new Set<string>(['properties']);

    // 4. Load & Aggregate Condition History (Bounded Query)
    sourceCollections.add('property_condition_history');
    const conditionSnap = await activeDb
      .collection('property_condition_history')
      .where('propertyId', '==', propertyId)
      .limit(MAX_PASSPORT_HISTORY_QUERY_LIMIT)
      .get();

    const conditionDocs = conditionSnap && Array.isArray(conditionSnap.docs)
      ? conditionSnap.docs
      : (conditionSnap && Array.isArray(conditionSnap) ? conditionSnap : []);

    const rawConditions: any[] = [];
    for (const doc of conditionDocs) {
      const data = typeof doc.data === 'function' ? doc.data() : doc.data;
      const cId = doc.id || data.conditionId;
      if (data) {
        // Lineage Check: Cross-property record rejection
        if (data.propertyId && data.propertyId !== propertyId) {
          throw new Error(`[PropertyPassport Lineage Violation] Condition record '${cId}' belongs to '${data.propertyId}', not '${propertyId}'`);
        }
        rawConditions.push({ id: cId, ...data });
      }
    }

    // Sort condition observations descending by observedAt
    rawConditions.sort((a, b) => {
      const dateA = new Date(a.observedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.observedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    // Group conditions by componentType (most recent per component)
    const latestConditionByComponent = new Map<string, any>();
    for (const c of rawConditions) {
      if (c.componentType) {
        const normComp = normalizeComponentType(c.componentType);
        if (!latestConditionByComponent.has(normComp)) {
          latestConditionByComponent.set(normComp, c);
        }
      }
    }

    const conditionSummary: PropertyPassportConditionSummary[] = [];
    for (const [normComp, c] of latestConditionByComponent.entries()) {
      const evidenceList: string[] = Array.isArray(c.evidenceIds) ? c.evidenceIds : [];
      for (const eid of evidenceList) {
        if (eid) allEvidenceIds.add(eid);
      }
      if (c.id) allSourceRecordIds.add(c.id);

      const condStatus: PassportVerificationStatus = c.status || (c.condition === 'derived' || c.provenance?.origin?.startsWith('ai') ? 'derived' : (evidenceList.length > 0 ? 'observed' : 'derived'));

      conditionSummary.push({
        componentType: normComp,
        condition: c.condition || c.lifecycleState || 'observed',
        lifecycleState: c.lifecycleState || 'operational',
        observedAt: c.observedAt || c.createdAt || new Date().toISOString(),
        evidenceIds: evidenceList.slice().sort(),
        sourceRecordId: c.id,
        status: condStatus,
      } as any);
    }

    // 5. Load & Aggregate Risk Intelligence & Retractions (Bounded Queries)
    sourceCollections.add('property_risk_history');
    sourceCollections.add('property_risk_retractions');

    const [riskSnap, retractionSnap] = await Promise.all([
      activeDb
        .collection('property_risk_history')
        .where('propertyId', '==', propertyId)
        .limit(MAX_PASSPORT_HISTORY_QUERY_LIMIT)
        .get(),
      activeDb
        .collection('property_risk_retractions')
        .where('propertyId', '==', propertyId)
        .limit(MAX_PASSPORT_HISTORY_QUERY_LIMIT)
        .get(),
    ]);

    const retractionDocs = retractionSnap && Array.isArray(retractionSnap.docs)
      ? retractionSnap.docs
      : (retractionSnap && Array.isArray(retractionSnap) ? retractionSnap : []);

    const retractedRiskIds = new Set<string>();
    for (const doc of retractionDocs) {
      const data = typeof doc.data === 'function' ? doc.data() : doc.data;
      if (data) {
        if (data.propertyId && data.propertyId !== propertyId) {
          throw new Error(`[PropertyPassport Lineage Violation] Risk retraction record belongs to '${data.propertyId}', not '${propertyId}'`);
        }
        if (data.riskAssessmentId) retractedRiskIds.add(data.riskAssessmentId);
        if (data.riskId) retractedRiskIds.add(data.riskId);
        if (data.originalRiskId) retractedRiskIds.add(data.originalRiskId);
        if (doc.id) allSourceRecordIds.add(doc.id);
      }
    }

    const riskDocs = riskSnap && Array.isArray(riskSnap.docs)
      ? riskSnap.docs
      : (riskSnap && Array.isArray(riskSnap) ? riskSnap : []);

    const activeRisks: any[] = [];
    for (const doc of riskDocs) {
      const data = typeof doc.data === 'function' ? doc.data() : doc.data;
      const rId = doc.id || data.riskId || data.riskAssessmentId;
      if (data) {
        if (data.propertyId && data.propertyId !== propertyId) {
          throw new Error(`[PropertyPassport Lineage Violation] Risk record '${rId}' belongs to '${data.propertyId}', not '${propertyId}'`);
        }
        if (!retractedRiskIds.has(rId) && data.status !== 'retracted') {
          activeRisks.push({ id: rId, ...data });
        }
      }
    }

    // Sort active risks by generatedAt descending
    activeRisks.sort((a, b) => {
      const dateA = new Date(a.generatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.generatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    const passportRisks: Array<{
      riskId: string;
      riskType: string;
      description: string;
      severity: SeverityLevel;
      evidenceIds: string[];
    }> = [];
    const riskEvidenceIds = new Set<string>();
    let maxRiskScore = 0;
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;

    for (const r of activeRisks) {
      const evList: string[] = Array.isArray(r.evidenceIds) ? r.evidenceIds : [];
      for (const eid of evList) {
        if (eid) {
          allEvidenceIds.add(eid);
          riskEvidenceIds.add(eid);
        }
      }
      if (r.id) allSourceRecordIds.add(r.id);

      const score = typeof r.riskScore === 'number' ? r.riskScore : (typeof r.score === 'number' ? r.score : 0);
      if (score > maxRiskScore) maxRiskScore = score;

      const sev: SeverityLevel = (r.severity as SeverityLevel) || 'low';
      if (sev === 'critical') criticalCount++;
      else if (sev === 'high') highCount++;
      else if (sev === 'medium') mediumCount++;

      passportRisks.push({
        riskId: r.id,
        riskType: r.riskType || 'structural',
        description: r.description || '',
        severity: sev,
        evidenceIds: evList.slice().sort(),
      });
    }

    let overallSeverity: SeverityLevel = 'low';
    if (criticalCount > 0) overallSeverity = 'critical';
    else if (highCount > 0) overallSeverity = 'high';
    else if (mediumCount > 0) overallSeverity = 'medium';

    const riskSummary: PropertyPassportRiskSummary = {
      riskScore: maxRiskScore,
      overallSeverity,
      activeRiskCount: activeRisks.length,
      criticalRiskCount: criticalCount,
      risks: passportRisks.sort((a, b) => a.riskId.localeCompare(b.riskId)),
      evidenceIds: Array.from(riskEvidenceIds).sort(),
    };

    // 6. Load & Aggregate Predictive Maintenance & Supersessions (Bounded Queries)
    sourceCollections.add('property_maintenance_history');
    sourceCollections.add('property_maintenance_supersessions');

    const [maintenanceSnap, supersessionSnap] = await Promise.all([
      activeDb
        .collection('property_maintenance_history')
        .where('propertyId', '==', propertyId)
        .limit(MAX_PASSPORT_HISTORY_QUERY_LIMIT)
        .get(),
      activeDb
        .collection('property_maintenance_supersessions')
        .where('propertyId', '==', propertyId)
        .limit(MAX_PASSPORT_HISTORY_QUERY_LIMIT)
        .get(),
    ]);

    const supersessionDocs = supersessionSnap && Array.isArray(supersessionSnap.docs)
      ? supersessionSnap.docs
      : (supersessionSnap && Array.isArray(supersessionSnap) ? supersessionSnap : []);

    const supersededMaintenanceIds = new Set<string>();
    for (const doc of supersessionDocs) {
      const data = typeof doc.data === 'function' ? doc.data() : doc.data;
      if (data) {
        if (data.propertyId && data.propertyId !== propertyId) {
          throw new Error(`[PropertyPassport Lineage Violation] Maintenance supersession record belongs to '${data.propertyId}', not '${propertyId}'`);
        }
        if (data.supersededMaintenanceId) supersededMaintenanceIds.add(data.supersededMaintenanceId);
        if (data.maintenanceAssessmentId) supersededMaintenanceIds.add(data.maintenanceAssessmentId);
        if (doc.id) allSourceRecordIds.add(doc.id);
      }
    }

    const maintenanceDocs = maintenanceSnap && Array.isArray(maintenanceSnap.docs)
      ? maintenanceSnap.docs
      : (maintenanceSnap && Array.isArray(maintenanceSnap) ? maintenanceSnap : []);

    const activeMaintenance: any[] = [];
    for (const doc of maintenanceDocs) {
      const data = typeof doc.data === 'function' ? doc.data() : doc.data;
      const mId = doc.id || data.maintenanceAssessmentId;
      if (data) {
        if (data.propertyId && data.propertyId !== propertyId) {
          throw new Error(`[PropertyPassport Lineage Violation] Maintenance record '${mId}' belongs to '${data.propertyId}', not '${propertyId}'`);
        }
        if (!supersededMaintenanceIds.has(mId) && data.status !== 'superseded') {
          activeMaintenance.push({ id: mId, ...data });
        }
      }
    }

    const upcomingActions: Array<{
      maintenanceAssessmentId: string;
      componentType: string;
      predictionType: string;
      forecastStart: string;
      forecastEnd: string;
      urgency: UrgencyLevel;
      evidenceIds: string[];
    }> = [];
    const maintenanceEvidenceIds = new Set<string>();
    let totalBudgetMin = 0;
    let totalBudgetMax = 0;
    let currency = 'GBP';

    for (const m of activeMaintenance) {
      const evList: string[] = Array.isArray(m.evidenceIds) ? m.evidenceIds : [];
      for (const eid of evList) {
        if (eid) {
          allEvidenceIds.add(eid);
          maintenanceEvidenceIds.add(eid);
        }
      }
      if (m.id) allSourceRecordIds.add(m.id);

      if (m.estimatedBenchmarkCost) {
        if (typeof m.estimatedBenchmarkCost.min === 'number') totalBudgetMin += m.estimatedBenchmarkCost.min;
        if (typeof m.estimatedBenchmarkCost.max === 'number') totalBudgetMax += m.estimatedBenchmarkCost.max;
        if (m.estimatedBenchmarkCost.currency) currency = m.estimatedBenchmarkCost.currency;
      }

      upcomingActions.push({
        maintenanceAssessmentId: m.id,
        componentType: normalizeComponentType(m.componentType || 'other'),
        predictionType: m.predictionType || m.intervention || 'maintenance',
        forecastStart: m.forecastStart || m.forecastWindow?.start || new Date().toISOString(),
        forecastEnd: m.forecastEnd || m.forecastWindow?.end || new Date().toISOString(),
        urgency: (m.urgency as UrgencyLevel) || 'planned',
        evidenceIds: evList.slice().sort(),
      });
    }

    const maintenanceSummary: PropertyPassportMaintenanceSummary = {
      upcomingInterventionsCount: activeMaintenance.length,
      estimatedTotalBudgetMin: totalBudgetMin,
      estimatedTotalBudgetMax: totalBudgetMax,
      currency,
      upcomingActions: upcomingActions.sort((a, b) => a.maintenanceAssessmentId.localeCompare(b.maintenanceAssessmentId)),
      evidenceIds: Array.from(maintenanceEvidenceIds).sort(),
    };

    // 7. Load Verified Outcomes / Completed Jobs (Bounded Query)
    sourceCollections.add('jobs');
    const [jobsByLinkedSnap, jobsByPropSnap] = await Promise.all([
      activeDb
        .collection('jobs')
        .where('linkedPropertyId', '==', propertyId)
        .limit(MAX_PASSPORT_HISTORY_QUERY_LIMIT)
        .get(),
      activeDb
        .collection('jobs')
        .where('propertyId', '==', propertyId)
        .limit(MAX_PASSPORT_HISTORY_QUERY_LIMIT)
        .get(),
    ]);

    const linkedJobDocs = jobsByLinkedSnap && Array.isArray(jobsByLinkedSnap.docs)
      ? jobsByLinkedSnap.docs
      : (jobsByLinkedSnap && Array.isArray(jobsByLinkedSnap) ? jobsByLinkedSnap : []);
    const propJobDocs = jobsByPropSnap && Array.isArray(jobsByPropSnap.docs)
      ? jobsByPropSnap.docs
      : (jobsByPropSnap && Array.isArray(jobsByPropSnap) ? jobsByPropSnap : []);

    const allJobDocsMap = new Map<string, any>();
    for (const doc of [...linkedJobDocs, ...propJobDocs]) {
      const data = typeof doc.data === 'function' ? doc.data() : doc.data;
      if (data) {
        allJobDocsMap.set(doc.id, data);
      }
    }

    const completedJobs: any[] = [];
    const outcomeEvidenceIds = new Set<string>();
    let lastCompletedAt: string | undefined;

    for (const [jobId, jobData] of allJobDocsMap.entries()) {
      const isCompleted = jobData.status === 'completed' || jobData.completed === true;
      if (isCompleted) {
        // Lineage Check
        const jPropId = jobData.linkedPropertyId || jobData.propertyId;
        if (jPropId && jPropId !== propertyId) {
          throw new Error(`[PropertyPassport Lineage Violation] Job '${jobId}' belongs to '${jPropId}', not '${propertyId}'`);
        }

        allSourceRecordIds.add(jobId);
        completedJobs.push({ id: jobId, ...jobData });

        const evList: string[] = Array.isArray(jobData.evidenceIds)
          ? jobData.evidenceIds
          : (Array.isArray(jobData.media) ? jobData.media : []);
        for (const eid of evList) {
          if (eid) {
            allEvidenceIds.add(eid);
            outcomeEvidenceIds.add(eid);
          }
        }

        const compDate = jobData.completedAt || jobData.updatedAt || jobData.createdAt;
        if (compDate) {
          if (!lastCompletedAt || new Date(compDate).getTime() > new Date(lastCompletedAt).getTime()) {
            lastCompletedAt = compDate;
          }
        }
      }
    }

    const verifiedOutcomeSummary: PropertyPassportVerifiedOutcomeSummary = {
      totalCompletedJobs: completedJobs.length,
      lastCompletedJobAt: lastCompletedAt,
      completedOutcomeIds: completedJobs.map(j => j.id).sort(),
      evidenceIds: Array.from(outcomeEvidenceIds).sort(),
    };

    // 8. Assemble Building Components with Non-Promotion Guarantee
    const componentsMap = new Map<string, PropertyPassportComponent>();

    // A. Start with explicit components registered on the property doc
    const propComponents: any[] = Array.isArray(propData?.intelligence?.buildingComponents)
      ? propData.intelligence.buildingComponents
      : (Array.isArray(propData?.buildingComponents) ? propData.buildingComponents : []);

    for (const c of propComponents) {
      if (c && c.componentType) {
        const validatedComp = validateComponentType(c.componentType);
        const evIds: string[] = Array.isArray(c.evidenceIds) ? c.evidenceIds.filter(Boolean) : [];
        for (const eid of evIds) allEvidenceIds.add(eid);

        // Security: Preserve provenance, do NOT promote AI status to verified
        let status: PassportVerificationStatus = 'unverified';
        if (c.status === 'verified' && evIds.length > 0) {
          status = 'verified';
        } else if (c.status === 'observed') {
          status = 'observed';
        } else if (c.status === 'derived') {
          status = 'derived';
        }

        componentsMap.set(validatedComp, {
          componentType: validatedComp,
          condition: c.condition || 'unknown',
          lifecycleState: c.lifecycleState || 'operational',
          status,
          lastObservedAt: c.lastObservedAt || c.installedDate,
          evidenceIds: evIds.slice().sort(),
          sourceRecordIds: c.sourceRecordId ? [c.sourceRecordId] : [],
        });
      }
    }

    // B. Merge with condition summary components
    for (const cs of conditionSummary) {
      const existing = componentsMap.get(cs.componentType);
      const isDerived = (cs as any).status === 'derived' || cs.condition === 'derived' || cs.evidenceIds.length === 0;
      const compStatus: PassportVerificationStatus = (cs as any).status === 'verified' && cs.evidenceIds.length > 0 ? 'verified' : (isDerived ? 'derived' : 'observed');

      if (existing) {
        existing.condition = cs.condition;
        existing.lifecycleState = cs.lifecycleState;
        existing.lastObservedAt = cs.observedAt;
        const mergedEv = Array.from(new Set([...existing.evidenceIds, ...cs.evidenceIds])).sort();
        existing.evidenceIds = mergedEv;
        if (cs.sourceRecordId && !existing.sourceRecordIds.includes(cs.sourceRecordId)) {
          existing.sourceRecordIds.push(cs.sourceRecordId);
        }
        if (existing.status !== 'verified') {
          existing.status = compStatus;
        }
      } else {
        componentsMap.set(cs.componentType, {
          componentType: cs.componentType,
          condition: cs.condition,
          lifecycleState: cs.lifecycleState,
          status: compStatus,
          lastObservedAt: cs.observedAt,
          evidenceIds: cs.evidenceIds.slice().sort(),
          sourceRecordIds: cs.sourceRecordId ? [cs.sourceRecordId] : [],
        });
      }
    }

    const sortedComponents = Array.from(componentsMap.values()).sort((a, b) =>
      a.componentType.localeCompare(b.componentType)
    );

    // 9. Multidimensional Confidence Scoring
    const totalEvidenceCount = allEvidenceIds.size;
    const evidenceQuality = totalEvidenceCount > 0 ? Math.min(1.0, 0.5 + totalEvidenceCount * 0.1) : 0.0;
    const overallConfidence = totalEvidenceCount > 0 ? Math.min(0.95, 0.6 + totalEvidenceCount * 0.08) : 0.4;

    const confidence: ConfidenceScores = {
      overall: Math.round(overallConfidence * 100) / 100,
      extraction: 0.9,
      evidenceQuality: Math.round(evidenceQuality * 100) / 100,
      classification: 0.95,
      temporalFreshness: 0.9,
      method: 'deterministic_heuristic',
    };

    const sortedEvidenceIds = Array.from(allEvidenceIds).sort();
    const sortedSourceRecordIds = Array.from(allSourceRecordIds).sort();
    const sortedSourceCollections = Array.from(sourceCollections).sort();

    // 10. Canonical Semantic Hashing (Excluding generatedAt for pure determinism)
    const canonicalPayload = {
      propertyId,
      components: sortedComponents,
      conditionSummary: conditionSummary.sort((a, b) => a.componentType.localeCompare(b.componentType)),
      riskSummary,
      maintenanceSummary,
      verifiedOutcomeSummary,
      evidenceIds: sortedEvidenceIds,
      sourceRecordIds: sortedSourceRecordIds,
      schemaVersion: PASSPORT_SCHEMA_VERSION,
      pipelineVersion: PASSPORT_PIPELINE_VERSION,
      tenantId: authoritativeTenant || '',
    };

    const contentHash = computeSha256(JSON.stringify(canonicalPayload));
    const snapshotId = `pps_${propertyId}_${contentHash.slice(0, 16)}`;
    const nowIso = new Date().toISOString();

    const provenance: PropertyPassportProvenance = {
      pipelineVersion: PASSPORT_PIPELINE_VERSION,
      schemaVersion: PASSPORT_SCHEMA_VERSION,
      generatedAt: nowIso,
      contentHash,
      snapshotId,
      sourceRecordIds: sortedSourceRecordIds,
      sourceCollections: sortedSourceCollections,
      tenantId: authoritativeTenant,
    };

    const passport: PropertyPassport = {
      propertyId,
      components: sortedComponents,
      conditionSummary: conditionSummary.sort((a, b) => a.componentType.localeCompare(b.componentType)),
      riskSummary,
      maintenanceSummary,
      verifiedOutcomeSummary,
      evidenceIds: sortedEvidenceIds,
      confidence,
      provenance,
      schemaVersion: PASSPORT_SCHEMA_VERSION,
      updatedAt: nowIso,
    };

    const snapshotRecord: PropertyPassportSnapshot = {
      ...passport,
      snapshotId,
      generatedAt: nowIso,
    };

    // 11. Transactional / Atomic Persistence to Firestore
    const cleanedSnapshot = cleanUndefinedFields(snapshotRecord);
    const cleanedPassport = cleanUndefinedFields(passport);

    if (typeof activeDb.runTransaction === 'function') {
      await activeDb.runTransaction(async (tx: any) => {
        const histRef = activeDb.collection('property_passport_history').doc(snapshotId);
        const currRef = activeDb.collection('property_passports').doc(propertyId);

        const existingHist = await tx.get(histRef);
        if (!existingHist || !existingHist.exists) {
          tx.set(histRef, cleanedSnapshot);
        }

        tx.set(currRef, cleanedPassport);
      });
    } else {
      // Direct writes (Mock or non-transactional store)
      const histRef = activeDb.collection('property_passport_history').doc(snapshotId);
      const currRef = activeDb.collection('property_passports').doc(propertyId);

      const existingHist = await histRef.get();
      if (!existingHist || !existingHist.exists) {
        await histRef.set(cleanedSnapshot);
      }
      await currRef.set(cleanedPassport);
    }

    return passport;
  }

  /**
   * Retrieves the current authoritative Property Passport projection for a property.
   */
  public async getLatestPassport(
    propertyId: string,
    options?: { firestoreDb?: any }
  ): Promise<PropertyPassport | null> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) {
      throw new Error('[PropertyPassport Error] Firestore database reference required');
    }

    const doc = await activeDb.collection('property_passports').doc(propertyId).get();
    if (!doc || !doc.exists) {
      return null;
    }

    const data = typeof doc.data === 'function' ? doc.data() : doc.data;
    return data as PropertyPassport;
  }

  /**
   * Retrieves the immutable historical snapshots for a property (bounded query).
   */
  public async getPassportHistory(
    propertyId: string,
    options?: { limit?: number; firestoreDb?: any }
  ): Promise<PropertyPassportSnapshot[]> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) {
      throw new Error('[PropertyPassport Error] Firestore database reference required');
    }

    const queryLimit = Math.min(options?.limit || 20, MAX_PASSPORT_HISTORY_QUERY_LIMIT);
    const snap = await activeDb
      .collection('property_passport_history')
      .where('propertyId', '==', propertyId)
      .limit(queryLimit)
      .get();

    const docs = snap && Array.isArray(snap.docs) ? snap.docs : (snap && Array.isArray(snap) ? snap : []);
    const results: PropertyPassportSnapshot[] = [];

    for (const doc of docs) {
      const data = typeof doc.data === 'function' ? doc.data() : doc.data;
      if (data) {
        results.push(data as PropertyPassportSnapshot);
      }
    }

    // Sort descending by generatedAt
    results.sort((a, b) => {
      const dateA = new Date(a.generatedAt || 0).getTime();
      const dateB = new Date(b.generatedAt || 0).getTime();
      return dateB - dateA;
    });

    return results;
  }

  /**
   * Retrieves a specific immutable snapshot by ID.
   */
  public async getPassportSnapshot(
    snapshotId: string,
    options?: { firestoreDb?: any }
  ): Promise<PropertyPassportSnapshot | null> {
    const activeDb = options?.firestoreDb || this.defaultDb || getGlobalIntelligenceDb();
    if (!activeDb) {
      throw new Error('[PropertyPassport Error] Firestore database reference required');
    }

    const doc = await activeDb.collection('property_passport_history').doc(snapshotId).get();
    if (!doc || !doc.exists) {
      return null;
    }

    const data = typeof doc.data === 'function' ? doc.data() : doc.data;
    return data as PropertyPassportSnapshot;
  }
}

export const propertyPassportService = new PropertyPassportService();

/**
 * Production Task Queue entry point for triggering Property Passport Projection
 */
export async function enqueuePropertyPassportTask(
  propertyId: string,
  input?: Partial<GeneratePropertyPassportInput> & { db?: any },
  options?: { firestoreDb?: any; idempotencyKey?: string }
): Promise<IntelligenceTask> {
  const activeDb = options?.firestoreDb || input?.db || getGlobalIntelligenceDb();
  if (activeDb) {
    intelligenceTaskQueue.setFirestoreDb(activeDb);
  }
  const idempKey = options?.idempotencyKey || `idem_pps_${propertyId}_${Date.now()}`;
  const payloadInput = { ...input };
  delete (payloadInput as any).db;

  return intelligenceTaskQueue.enqueueTaskAsync(
    'property_passport',
    'property',
    propertyId,
    idempKey,
    {
      ...payloadInput,
      propertyId,
    }
  );
}
