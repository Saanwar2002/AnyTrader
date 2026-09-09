/**
 * Standardized HTTP Error Layer for AnyTrader V6
 * Sanitizes errors sent to clients, suppresses internal stack traces and secrets,
 * and maintains unique correlation IDs for server audit logs.
 */
import type { Request, Response } from "express";
import crypto from "crypto";

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isPublicSafe: boolean;
  public readonly correlationId: string;
  public readonly details?: Record<string, any>;

  constructor(
    statusCode: number,
    message: string,
    errorCode: string = "INTERNAL_ERROR",
    isPublicSafe: boolean = false,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isPublicSafe = isPublicSafe;
    this.correlationId = `err_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string = "Bad Request", details?: Record<string, any>) {
    super(400, message, "BAD_REQUEST", true, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string = "Authentication required", details?: Record<string, any>) {
    super(401, message, "UNAUTHORIZED", true, details);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string = "Access denied", details?: Record<string, any>) {
    super(403, message, "FORBIDDEN", true, details);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = "Resource not found", details?: Record<string, any>) {
    super(404, message, "NOT_FOUND", true, details);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string = "Resource state conflict", details?: Record<string, any>) {
    super(409, message, "CONFLICT", true, details);
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message: string = "Invalid entity data", details?: Record<string, any>) {
    super(422, message, "UNPROCESSABLE_ENTITY", true, details);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message: string = "Rate limit exceeded. Please try again later.") {
    super(429, message, "RATE_LIMIT_EXCEEDED", true);
  }
}

export class InternalServerError extends HttpError {
  constructor(message: string = "An unexpected server error occurred", details?: Record<string, any>) {
    super(500, message, "INTERNAL_SERVER_ERROR", false, details);
  }
}

/**
 * Express error responder that guarantees no sensitive paths, stack traces,
 * or credentials are leaked to the client.
 */
export function sendHttpError(res: Response, err: unknown, req?: Request): void {
  const isProd = process.env.NODE_ENV === "production";
  
  if (err instanceof HttpError) {
    const responsePayload: Record<string, any> = {
      success: false,
      error: err.isPublicSafe || !isProd ? err.message : "An unexpected error occurred. Please try again.",
      code: err.errorCode,
      correlationId: err.correlationId,
    };
    if (err.details && (err.isPublicSafe || !isProd)) {
      responsePayload.details = err.details;
    }
    
    console.error(`[HttpError ${err.statusCode} - ${err.errorCode}] Correlation: ${err.correlationId}`, {
      path: req?.originalUrl,
      method: req?.method,
      message: err.message,
      stack: !isProd ? err.stack : undefined,
    });
    
    res.status(err.statusCode).json(responsePayload);
    return;
  }

  // Handle generic / unexpected exceptions
  const genericCorrelationId = `err_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const rawMessage = err instanceof Error ? err.message : String(err);
  
  console.error(`[UnhandledError 500] Correlation: ${genericCorrelationId}`, {
    path: req?.originalUrl,
    method: req?.method,
    rawError: err,
  });

  res.status(500).json({
    success: false,
    error: isProd ? "Internal server error. Please try again later." : rawMessage,
    code: "INTERNAL_SERVER_ERROR",
    correlationId: genericCorrelationId,
  });
}
