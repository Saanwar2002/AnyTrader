/**
 * AnyTrader V8.1 — Controlled Vocabulary & Canonical Code Registry
 * 
 * Provides:
 * - Extensible vocabulary mappings for building components, conditions, domains, and severity
 * - Deterministic term normalization (trimming, lowercasing, snake_casing, alias resolution)
 * - Safe fallback (unrecognized terms preserve clean formatting without guessing/hallucination)
 */

// ----------------------------------------------------
// Pre-defined Canonical Vocabulary Registries
// ----------------------------------------------------

export const COMPONENT_ALIASES: Map<string, string> = new Map([
  ['roof', 'roof'],
  ['roofing', 'roof'],
  ['tiles', 'roof'],
  ['slates', 'roof'],
  ['shingles', 'roof'],
  ['flat_roof', 'roof'],
  ['flat roof', 'roof'],
  ['pitched_roof', 'roof'],
  ['pitched roof', 'roof'],
  ['fascia', 'roof'],
  ['soffit', 'roof'],
  ['boiler', 'boiler'],
  ['combi_boiler', 'boiler'],
  ['combi boiler', 'boiler'],
  ['system_boiler', 'boiler'],
  ['water_heater', 'boiler'],
  ['furnace', 'boiler'],
  ['window', 'window'],
  ['windows', 'window'],
  ['glazing', 'window'],
  ['double_glazing', 'window'],
  ['double glazing', 'window'],
  ['triple_glazing', 'window'],
  ['casement_window', 'window'],
  ['sash_window', 'window'],
  ['skylight', 'window'],
  ['velux', 'window'],
  ['electrical_panel', 'electrical_panel'],
  ['fuse_box', 'electrical_panel'],
  ['fuse box', 'electrical_panel'],
  ['consumer_unit', 'electrical_panel'],
  ['breaker_box', 'electrical_panel'],
  ['distribution_board', 'electrical_panel'],
  ['pipe', 'pipe'],
  ['pipes', 'pipe'],
  ['piping', 'pipe'],
  ['plumbing_pipe', 'pipe'],
  ['water_pipe', 'pipe'],
  ['copper_pipe', 'pipe'],
  ['waste_pipe', 'pipe'],
  ['lead_pipe', 'pipe'],
  ['gutter', 'gutter'],
  ['gutters', 'gutter'],
  ['guttering', 'gutter'],
  ['downpipe', 'gutter'],
  ['rainwater_pipe', 'gutter'],
  ['radiator', 'radiator'],
  ['radiators', 'radiator'],
  ['heater', 'radiator'],
  ['towel_rail', 'radiator'],
  ['drainage', 'drainage'],
  ['drain', 'drainage'],
  ['drains', 'drainage'],
  ['sewer', 'drainage'],
  ['manhole', 'drainage'],
  ['soil_stack', 'drainage'],
  ['wall', 'wall'],
  ['walls', 'wall'],
  ['brickwork', 'wall'],
  ['masonry', 'wall'],
  ['stud_wall', 'wall'],
  ['cavity_wall', 'wall'],
  ['floor', 'floor'],
  ['flooring', 'floor'],
  ['joists', 'floor'],
  ['floorboards', 'floor'],
  ['foundation', 'foundation'],
  ['footings', 'foundation'],
  ['underpinning', 'foundation'],
  ['door', 'door'],
  ['doors', 'door'],
  ['entrance_door', 'door'],
  ['fire_door', 'door'],
  ['patio_door', 'door'],
  ['chimney', 'chimney'],
  ['flue', 'chimney'],
  ['chimney_stack', 'chimney'],
  ['hvac', 'hvac'],
  ['air_conditioning', 'hvac'],
  ['ventilation', 'hvac'],
]);

const CONDITION_ALIASES: Map<string, string> = new Map([
  ['damaged', 'damaged'],
  ['broken', 'damaged'],
  ['cracked', 'damaged'],
  ['fractured', 'damaged'],
  ['smashed', 'damaged'],
  ['ruined', 'damaged'],
  ['worn', 'worn'],
  ['aged', 'worn'],
  ['deteriorated', 'worn'],
  ['weathered', 'worn'],
  ['degraded', 'worn'],
  ['corroded', 'worn'],
  ['eroded', 'worn'],
  ['leaking', 'leaking'],
  ['dripping', 'leaking'],
  ['water_ingress', 'leaking'],
  ['water ingress', 'leaking'],
  ['seeping', 'leaking'],
  ['perforated', 'leaking'],
  ['blocked', 'blocked'],
  ['clogged', 'blocked'],
  ['obstructed', 'blocked'],
  ['choked', 'blocked'],
  ['jammed', 'blocked'],
  ['failed', 'failed'],
  ['inoperable', 'failed'],
  ['defective', 'failed'],
  ['dead', 'failed'],
  ['non_functioning', 'failed'],
  ['tripping', 'failed'],
  ['operational', 'operational'],
  ['working', 'operational'],
  ['functional', 'operational'],
  ['good', 'operational'],
  ['acceptable', 'operational'],
  ['intact', 'operational'],
  ['loose', 'loose'],
  ['unstable', 'loose'],
  ['detached', 'loose'],
  ['wobbly', 'loose'],
  ['missing', 'missing'],
  ['absent', 'missing'],
  ['lost', 'missing'],
]);

const DOMAIN_ALIASES: Map<string, string> = new Map([
  ['roofing', 'roofing'],
  ['roof', 'roofing'],
  ['plumbing', 'plumbing'],
  ['plumber', 'plumbing'],
  ['electrical', 'electrical'],
  ['electrician', 'electrical'],
  ['electrics', 'electrical'],
  ['heating', 'heating'],
  ['gas', 'gas'],
  ['gas_and_heating', 'heating'],
  ['carpentry', 'carpentry'],
  ['joinery', 'carpentry'],
  ['glazing', 'glazing'],
  ['windows', 'glazing'],
  ['bricklaying', 'bricklaying'],
  ['masonry', 'bricklaying'],
  ['plastering', 'plastering'],
  ['rendering', 'plastering'],
  ['painting_decorating', 'painting_decorating'],
  ['painting', 'painting_decorating'],
  ['decorating', 'painting_decorating'],
  ['drainage', 'drainage'],
  ['locksmith', 'locksmith'],
  ['security_systems', 'security_systems'],
  ['landscaping', 'landscaping'],
  ['waste_clearance', 'waste_clearance'],
  ['general_construction', 'general_construction'],
  ['building', 'general_construction'],
]);

/**
 * Deterministically standardizes raw string terms to lower_snake_case
 */
export function sanitizeTerm(raw?: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Normalizes a component string using the controlled vocabulary or clean snake_case formatting.
 */
export function normalizeComponentCode(raw?: string): string | undefined {
  if (!raw || raw.trim().length === 0) return undefined;
  const sanitized = sanitizeTerm(raw);
  if (!sanitized) return undefined;
  const canonical = COMPONENT_ALIASES.get(sanitized) || COMPONENT_ALIASES.get(raw.trim().toLowerCase());
  return canonical || sanitized;
}

/**
 * Normalizes a condition string using the controlled vocabulary or clean snake_case formatting.
 */
export function normalizeConditionCode(raw?: string): string | undefined {
  if (!raw || raw.trim().length === 0) return undefined;
  const sanitized = sanitizeTerm(raw);
  if (!sanitized) return undefined;
  const canonical = CONDITION_ALIASES.get(sanitized) || CONDITION_ALIASES.get(raw.trim().toLowerCase());
  return canonical || sanitized;
}

/**
 * Normalizes a domain/trade string using the controlled vocabulary or clean snake_case formatting.
 */
export function normalizeDomainCode(raw?: string): string {
  if (!raw || raw.trim().length === 0) return 'general';
  const sanitized = sanitizeTerm(raw);
  if (!sanitized) return 'general';
  const canonical = DOMAIN_ALIASES.get(sanitized) || DOMAIN_ALIASES.get(raw.trim().toLowerCase());
  return canonical || sanitized;
}

/**
 * Extensible registration for new canonical components and their synonyms.
 */
export function registerCanonicalComponent(canonicalCode: string, aliases: string[] = []): void {
  const normCode = sanitizeTerm(canonicalCode);
  COMPONENT_ALIASES.set(normCode, normCode);
  COMPONENT_ALIASES.set(canonicalCode.trim().toLowerCase(), normCode);
  for (const alias of aliases) {
    COMPONENT_ALIASES.set(sanitizeTerm(alias), normCode);
    COMPONENT_ALIASES.set(alias.trim().toLowerCase(), normCode);
  }
}

/**
 * Extensible registration for new canonical conditions and their synonyms.
 */
export function registerCanonicalCondition(canonicalCode: string, aliases: string[] = []): void {
  const normCode = sanitizeTerm(canonicalCode);
  CONDITION_ALIASES.set(normCode, normCode);
  CONDITION_ALIASES.set(canonicalCode.trim().toLowerCase(), normCode);
  for (const alias of aliases) {
    CONDITION_ALIASES.set(sanitizeTerm(alias), normCode);
    CONDITION_ALIASES.set(alias.trim().toLowerCase(), normCode);
  }
}

/**
 * Extensible registration for new canonical domains and their synonyms.
 */
export function registerCanonicalDomain(canonicalCode: string, aliases: string[] = []): void {
  const normCode = sanitizeTerm(canonicalCode);
  DOMAIN_ALIASES.set(normCode, normCode);
  DOMAIN_ALIASES.set(canonicalCode.trim().toLowerCase(), normCode);
  for (const alias of aliases) {
    DOMAIN_ALIASES.set(sanitizeTerm(alias), normCode);
    DOMAIN_ALIASES.set(alias.trim().toLowerCase(), normCode);
  }
}
