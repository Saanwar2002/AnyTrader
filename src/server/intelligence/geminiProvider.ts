/**
 * AnyTrader V8.1 — Model Provider Abstraction & Gemini Integration
 * 
 * Implements:
 * - Decoupled IntelligenceModelProvider interface
 * - Asynchronous Gemini 3.8 Flash extraction via @google/genai SDK
 * - Strict Zod schema validation on candidate outputs
 * - Token and economic metrics tracking (cost estimation)
 */

import { GoogleGenAI } from '@google/genai';
import { buildSecuredPrompt } from './promptDefense';
import { JobExtractionCandidateSchema, PropertyRollupCandidateSchema } from './schemas';

export interface ModelExtractionResult<T> {
  candidate: T;
  metrics: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    processingDurationMs: number;
  };
  rawResponseText: string;
}

export interface IntelligenceModelProvider {
  extractJobCandidate(
    jobId: string,
    untrustedEvidence: Array<{ id: string; type: string; content: string }>
  ): Promise<ModelExtractionResult<ReturnType<typeof JobExtractionCandidateSchema.parse>>>;

  rollupPropertyCandidate(
    propertyId: string,
    jobHistories: Array<{ jobId: string; category: string; problem: string; scope: string[] }>,
    untrustedEvidence: Array<{ id: string; type: string; content: string }>
  ): Promise<ModelExtractionResult<ReturnType<typeof PropertyRollupCandidateSchema.parse>>>;
}

export class GeminiIntelligenceProvider implements IntelligenceModelProvider {
  private ai: GoogleGenAI | null = null;
  private modelName = 'gemini-3.8-flash';

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      this.ai = new GoogleGenAI({ apiKey: key });
    }
  }

  private isLive(): boolean {
    return this.ai !== null;
  }

  /**
   * Estimates cost for gemini-3.8-flash:
   * ~$0.075 per 1M input tokens, ~$0.30 per 1M output tokens
   */
  private estimateCost(inputTokens: number, outputTokens: number): number {
    const cost = (inputTokens / 1_000_000) * 0.075 + (outputTokens / 1_000_000) * 0.30;
    return Number(cost.toFixed(6));
  }

  async extractJobCandidate(
    jobId: string,
    untrustedEvidence: Array<{ id: string; type: string; content: string }>
  ): Promise<ModelExtractionResult<ReturnType<typeof JobExtractionCandidateSchema.parse>>> {
    const startTime = Date.now();

    const taskInstruction = `
Analyze the provided evidence items for job ${jobId}.
Extract:
1. Canonical trade category (e.g., Plumbing, Electrical, Roofing, Carpentry, Heating)
2. Primary building component affected (e.g., Boiler, Roof Ridge Tiles, Consumer Unit, Waste Pipe)
3. Observed problem statement
4. Scope checklist of concrete repair actions (1 to 10 bullet items)
5. Recommended intervention description
6. candidateConfidence (between 0.1 and 0.95)
7. identifiedEvidenceReferences (list of evidence IDs that support these assertions)
`.trim();

    const outputSchema = `
JSON Object:
{
  "category": "string",
  "buildingComponent": "string",
  "observedProblem": "string",
  "extractedScope": ["string"],
  "recommendedIntervention": "string",
  "candidateConfidence": 0.85,
  "identifiedEvidenceReferences": ["ev_1"]
}
`.trim();

    const prompt = buildSecuredPrompt({
      taskInstruction,
      outputJsonSchemaDescription: outputSchema,
      untrustedSources: untrustedEvidence,
    });

    let rawText = '';
    let inTokens = 150;
    let outTokens = 120;

    if (this.isLive()) {
      try {
        const response = await this.ai!.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
        rawText = response.text || '{}';
        if (response.usageMetadata) {
          inTokens = response.usageMetadata.promptTokenCount || inTokens;
          outTokens = response.usageMetadata.candidatesTokenCount || outTokens;
        }
      } catch (err) {
        throw new Error(`[GeminiIntelligenceProvider] Live model extraction failed: ${(err as Error).message}`);
      }
    } else {
      // Deterministic fallback for test environments or offline verification
      const primaryEvidence = untrustedEvidence[0];
      const evidenceId = primaryEvidence ? primaryEvidence.id : 'ev_default';
      rawText = JSON.stringify({
        category: 'Plumbing',
        buildingComponent: 'Combi Boiler Heat Exchanger',
        observedProblem: 'Loss of system pressure and erratic hot water delivery observed from diagnostic evidence',
        extractedScope: [
          'Isolate electrical mains and gas supply',
          'Drain boiler circuit and depressurize expansion vessel',
          'Inspect diverter valve seal and heat exchanger plate for mineral fouling',
          'Re-pressurize to 1.5 bar and conduct flue gas analysis'
        ],
        recommendedIntervention: 'Power-flush boiler circuit, replace diverter valve cartridge, and inspect pressure relief valve',
        candidateConfidence: 0.88,
        identifiedEvidenceReferences: [evidenceId],
      });
    }

    const duration = Date.now() - startTime;
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      throw new Error(`[GeminiIntelligenceProvider] Malformed JSON from model: ${rawText.slice(0, 100)}`);
    }

    // Strict Zod schema validation
    const candidate = JobExtractionCandidateSchema.parse(parsedJson);

    return {
      candidate,
      metrics: {
        model: this.modelName,
        inputTokens: inTokens,
        outputTokens: outTokens,
        totalTokens: inTokens + outTokens,
        estimatedCostUsd: this.estimateCost(inTokens, outTokens),
        processingDurationMs: duration,
      },
      rawResponseText: rawText,
    };
  }

  async rollupPropertyCandidate(
    propertyId: string,
    jobHistories: Array<{ jobId: string; category: string; problem: string; scope: string[] }>,
    untrustedEvidence: Array<{ id: string; type: string; content: string }>
  ): Promise<ModelExtractionResult<ReturnType<typeof PropertyRollupCandidateSchema.parse>>> {
    const startTime = Date.now();

    const taskInstruction = `
Aggregate property intelligence for property ${propertyId}.
Combine historical job records and corroborating evidence into:
1. buildingComponents with condition and confidence
2. observedConditions with severity (low, medium, high, critical)
3. recommendedInterventions with urgency (immediate, medium_term, planned)
4. overallHealthScore (0 to 100)
`.trim();

    const outputSchema = `
JSON Object:
{
  "buildingComponents": [
    { "component": "Roofing", "condition": "Good", "confidence": 0.9, "evidenceIds": ["ev_1"] }
  ],
  "observedConditions": [
    { "condition": "Minor guttering leak", "severity": "low", "component": "Roofing", "evidenceIds": ["ev_1"] }
  ],
  "recommendedInterventions": [
    { "intervention": "Clear debris and reseal gutter union", "urgency": "planned", "estimatedBenchmarkCost": { "min": 60, "max": 120 }, "component": "Roofing" }
  ],
  "overallHealthScore": 88
}
`.trim();

    const combinedSources = [
      ...jobHistories.map((j) => ({
        id: `job_${j.jobId}`,
        type: 'historical_job',
        content: `Category: ${j.category}\nProblem: ${j.problem}\nScope: ${j.scope.join(', ')}`,
      })),
      ...untrustedEvidence,
    ];

    const prompt = buildSecuredPrompt({
      taskInstruction,
      outputJsonSchemaDescription: outputSchema,
      untrustedSources: combinedSources,
    });

    let rawText = '';
    let inTokens = 250;
    let outTokens = 180;

    if (this.isLive()) {
      try {
        const response = await this.ai!.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
        rawText = response.text || '{}';
        if (response.usageMetadata) {
          inTokens = response.usageMetadata.promptTokenCount || inTokens;
          outTokens = response.usageMetadata.candidatesTokenCount || outTokens;
        }
      } catch (err) {
        throw new Error(`[GeminiIntelligenceProvider] Property rollup failed: ${(err as Error).message}`);
      }
    } else {
      const evId = untrustedEvidence[0]?.id || 'ev_prop_1';
      rawText = JSON.stringify({
        buildingComponents: [
          {
            component: 'Central Heating System',
            condition: 'Fair - Serviced within 12 months',
            confidence: 0.92,
            evidenceIds: [evId],
          },
          {
            component: 'Electrical Consumer Unit',
            condition: 'Compliant with minor observation',
            confidence: 0.88,
            evidenceIds: [evId],
          }
        ],
        observedConditions: [
          {
            condition: 'Intermittent boiler pressure decline',
            severity: 'medium',
            component: 'Central Heating System',
            evidenceIds: [evId],
          }
        ],
        recommendedInterventions: [
          {
            intervention: 'Annual CP12 gas safety certification and expansion vessel recharge',
            urgency: 'medium_term',
            estimatedBenchmarkCost: { min: 95, max: 180 },
            component: 'Central Heating System',
          }
        ],
        overallHealthScore: 84,
      });
    }

    const duration = Date.now() - startTime;
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      throw new Error(`[GeminiIntelligenceProvider] Malformed JSON from model: ${rawText.slice(0, 100)}`);
    }

    const candidate = PropertyRollupCandidateSchema.parse(parsedJson);

    return {
      candidate,
      metrics: {
        model: this.modelName,
        inputTokens: inTokens,
        outputTokens: outTokens,
        totalTokens: inTokens + outTokens,
        estimatedCostUsd: this.estimateCost(inTokens, outTokens),
        processingDurationMs: duration,
      },
      rawResponseText: rawText,
    };
  }
}
