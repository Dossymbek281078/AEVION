export type QRightErrorCode =
  | "INVALID_HMAC"
  | "INSUFFICIENT_SHARDS"
  | "RECONSTRUCTION_FAILED"
  | "LEGACY_RECORD"
  | "MISSING_SHARD_HMAC_SECRET"
  | "MISSING_QSIGN_SECRET"
  | "SHIELD_NOT_FOUND"
  | "TAMPERED_SHARD"
  | "DUPLICATE_SHARD_INDEX"
  | "INVALID_SHARD_FORMAT"
  | "DEMO_DISABLED"
  | "RATE_LIMITED"
  | "WITNESS_NOT_FOUND"
  | "INTERNAL_ERROR";

export class QRightError extends Error {
  public readonly code: QRightErrorCode;
  public readonly httpStatus: number;

  constructor(code: QRightErrorCode, httpStatus: number, message?: string) {
    super(message || code);
    this.name = "QRightError";
    this.code = code;
    this.httpStatus = httpStatus;
    Object.setPrototypeOf(this, QRightError.prototype);
  }

  public toJSON(): { code: QRightErrorCode; message: string } {
    return { code: this.code, message: this.message };
  }
}
