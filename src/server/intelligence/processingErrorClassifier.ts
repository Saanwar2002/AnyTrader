/**
 * AnyTrader V8.1 — Task 14: Controlled Error Classifier & Sanitizer
 * 
 * Invariants & Protections:
 * - Controlled Error Codes: Strictly mapped to predefined ControlledErrorCode union.
 * - Centralized Retryability: Retryability is determined strictly by code and error classification logic,
 *   never by arbitrary AI model text.
 * - Privacy & Data Minimization: Scrub all credentials, tokens, bearer headers, passwords,
 *   email addresses, raw customer descriptions, and full stack traces from operational records.
 * - Bounded Diagnostics: Diagnostic strings are strictly capped at 256 characters.
 */

import { ControlledErrorCode } from './types';
import { AICandidateSecurityError } from './aiCandidateBoundary';

export interface ClassifiedProcessingError {
  errorCode: ControlledErrorCode;
  errorClass: string;
  retryable: boolean;
  sanitizedDiagnostic: string;
}

/**
 * Redacts secrets, PII, and unbounded traces from error diagnostic messages.
 */
export function sanitizeDiagnostic(rawMessage: string): string {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return 'Unknown error';
  }

  let sanitized = rawMessage
    // Redact Bearer tokens & auth headers
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/Authorization:\s*[^\s]+/gi, 'Authorization: [REDACTED]')
    // Redact common API keys
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
    .replace(/sk-[0-9A-Za-z-_]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/key=[A-Za-z0-9\-_]+/gi, 'key=[REDACTED]')
    .replace(/api_key=[A-Za-z0-9\-_]+/gi, 'api_key=[REDACTED]')
    .replace(/password[:=]\s*[^\s,]+/gi, 'password=[REDACTED]')
    // Redact email addresses
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[REDACTED_EMAIL]')
    // Strip stack trace paths and line numbers
    .replace(/at\s+.*\(?.*:\d+:\d+\)?/g, '')
    // Strip file system absolute paths
    .replace(/\/app\/[a-zA-Z0-9_./-]+/g, '[PATH]')
    .replace(/\/home\/[a-zA-Z0-9_./-]+/g, '[PATH]')
    // Collapse multi-whitespace and newlines
    .replace(/\s+/g, ' ')
    .trim();

  if (sanitized.length === 0) {
    sanitized = 'Error occurred';
  }

  // Bound diagnostic length to 256 chars
  if (sanitized.length > 256) {
    sanitized = sanitized.slice(0, 253) + '...';
  }

  return sanitized;
}

/**
 * Classifies an error into a controlled error classification with deterministic retryability.
 */
export function classifyAndSanitizeProcessingError(err: unknown): ClassifiedProcessingError {
  if (!err) {
    return {
      errorCode: 'unknown_error',
      errorClass: 'UnknownError',
      retryable: true,
      sanitizedDiagnostic: 'Unknown error occurred',
    };
  }

  const rawMessage = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : 'Error';
  const code = (err as any)?.code || (err as any)?.errorCode || '';
  const messageLower = rawMessage.toLowerCase();
  const sanitizedDiagnostic = sanitizeDiagnostic(rawMessage);

  // 1. Lineage & Provenance Errors (Strictly Non-Retryable)
  if (
    name === 'LineageValidationError' ||
    name === 'MissingEvidenceError' ||
    name === 'LineageTamperingError' ||
    messageLower.includes('lineage validation') ||
    messageLower.includes('no evidence') ||
    messageLower.includes('missing required evidence') ||
    code === 'LINEAGE_ERROR' ||
    code === 'MISSING_EVIDENCE'
  ) {
    return {
      errorCode: 'lineage_error',
      errorClass: name || 'LineageValidationError',
      retryable: false,
      sanitizedDiagnostic,
    };
  }

  // 2. Candidate Security & Validation Errors (Strictly Non-Retryable)
  if (
    err instanceof AICandidateSecurityError ||
    name === 'AICandidateSecurityError' ||
    name === 'ZodError' ||
    name === 'ValidationError' ||
    messageLower.includes('validation error') ||
    messageLower.includes('schema validation failed') ||
    messageLower.includes('budget error') ||
    messageLower.includes('budget exceeded') ||
    messageLower.includes('invalid argument') ||
    code === 'INVALID_ARGUMENT' ||
    code === 'VALIDATION_ERROR' ||
    code === 'SECURITY_VIOLATION'
  ) {
    return {
      errorCode: 'validation_error',
      errorClass: name || 'ValidationError',
      retryable: false,
      sanitizedDiagnostic,
    };
  }

  // 3. Payload Too Large (Strictly Non-Retryable)
  if (
    messageLower.includes('payload too large') ||
    messageLower.includes('exceeded 100 kib') ||
    messageLower.includes('budget error: exceeded') ||
    messageLower.includes('entity too large') ||
    code === 'PAYLOAD_TOO_LARGE' ||
    code === '413'
  ) {
    return {
      errorCode: 'payload_too_large',
      errorClass: 'PayloadTooLargeError',
      retryable: false,
      sanitizedDiagnostic,
    };
  }

  // 4. Configuration Errors (Strictly Non-Retryable)
  if (
    messageLower.includes('configuration error') ||
    messageLower.includes('missing handler') ||
    messageLower.includes('no handler registered') ||
    messageLower.includes('firestore db reference is required') ||
    messageLower.includes('api key is required') ||
    messageLower.includes('invalid configuration') ||
    code === 'MISSING_HANDLER' ||
    code === 'CONFIGURATION_ERROR'
  ) {
    return {
      errorCode: 'configuration_error',
      errorClass: 'ConfigurationError',
      retryable: false,
      sanitizedDiagnostic,
    };
  }

  // 5. Authentication & Authorization Errors (Strictly Non-Retryable)
  if (
    messageLower.includes('unauthenticated') ||
    messageLower.includes('invalid token') ||
    messageLower.includes('invalid credentials') ||
    code === 'UNAUTHENTICATED' ||
    code === '401'
  ) {
    return {
      errorCode: 'authentication_error',
      errorClass: 'AuthenticationError',
      retryable: false,
      sanitizedDiagnostic,
    };
  }

  if (
    messageLower.includes('permission denied') ||
    messageLower.includes('permission_denied') ||
    messageLower.includes('forbidden') ||
    messageLower.includes('unauthorized') ||
    code === 'PERMISSION_DENIED' ||
    code === '403'
  ) {
    return {
      errorCode: 'authorization_error',
      errorClass: 'AuthorizationError',
      retryable: false,
      sanitizedDiagnostic,
    };
  }

  // 6. Rate Limit (Retryable)
  if (
    messageLower.includes('429') ||
    messageLower.includes('rate limit') ||
    messageLower.includes('resource_exhausted') ||
    messageLower.includes('quota exceeded') ||
    messageLower.includes('too many requests') ||
    code === 'RESOURCE_EXHAUSTED' ||
    code === '429'
  ) {
    return {
      errorCode: 'rate_limit',
      errorClass: 'RateLimitError',
      retryable: true,
      sanitizedDiagnostic,
    };
  }

  // 7. Timeout & Deadline Exceeded (Retryable)
  if (
    messageLower.includes('timeout') ||
    messageLower.includes('timed out') ||
    messageLower.includes('deadline_exceeded') ||
    messageLower.includes('etimedout') ||
    messageLower.includes('gateway timeout') ||
    code === 'DEADLINE_EXCEEDED' ||
    code === 'ETIMEDOUT' ||
    code === '504'
  ) {
    return {
      errorCode: 'timeout',
      errorClass: 'TimeoutError',
      retryable: true,
      sanitizedDiagnostic,
    };
  }

  // 8. Network Error (Retryable)
  if (
    messageLower.includes('network error') ||
    messageLower.includes('econnreset') ||
    messageLower.includes('econnrefused') ||
    messageLower.includes('socket hang up') ||
    messageLower.includes('network disconnect') ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED'
  ) {
    return {
      errorCode: 'network_error',
      errorClass: 'NetworkError',
      retryable: true,
      sanitizedDiagnostic,
    };
  }

  // 9. Firestore Error
  if (
    messageLower.includes('firestore') ||
    code.startsWith('FIRESTORE_') ||
    name.toLowerCase().includes('firestore')
  ) {
    const isTransient =
      messageLower.includes('unavailable') ||
      messageLower.includes('deadline') ||
      messageLower.includes('conflict') ||
      messageLower.includes('contention') ||
      code === 'UNAVAILABLE' ||
      code === 'ABORTED';
    return {
      errorCode: 'firestore_error',
      errorClass: name || 'FirestoreError',
      retryable: isTransient,
      sanitizedDiagnostic,
    };
  }

  // 10. Storage Error
  if (
    messageLower.includes('storage') ||
    name.toLowerCase().includes('storage') ||
    code.startsWith('STORAGE_')
  ) {
    const isTransient =
      messageLower.includes('unavailable') ||
      messageLower.includes('timeout') ||
      messageLower.includes('503');
    return {
      errorCode: 'storage_error',
      errorClass: name || 'StorageError',
      retryable: isTransient,
      sanitizedDiagnostic,
    };
  }

  // 11. Provider Error (AI / Cloud Provider)
  if (
    messageLower.includes('provider') ||
    messageLower.includes('gemini') ||
    messageLower.includes('openai') ||
    messageLower.includes('model error') ||
    code.startsWith('PROVIDER_') ||
    code === '500' ||
    code === '503'
  ) {
    const isTransient =
      messageLower.includes('503') ||
      messageLower.includes('500') ||
      messageLower.includes('unavailable') ||
      messageLower.includes('internal error');
    return {
      errorCode: 'provider_error',
      errorClass: name || 'ProviderError',
      retryable: isTransient,
      sanitizedDiagnostic,
    };
  }

  // Tier-B durable storage errors
  if (name === 'RawArtifactPersistenceError' || messageLower.includes('[tierb]')) {
    return {
      errorCode: 'storage_persistence_error',
      errorClass: name || 'RawArtifactPersistenceError',
      retryable: true,
      sanitizedDiagnostic,
    };
  }
  if (name === 'RawArtifactIntegrityError' || messageLower.includes('[tierb integrity]')) {
    return {
      errorCode: 'storage_integrity_error',
      errorClass: name || 'RawArtifactIntegrityError',
      retryable: false,
      sanitizedDiagnostic,
    };
  }

  // 12. Default Unknown Error (Retryable with bounded retries)
  return {
    errorCode: 'unknown_error',
    errorClass: name || 'UnknownError',
    retryable: true,
    sanitizedDiagnostic,
  };
}
