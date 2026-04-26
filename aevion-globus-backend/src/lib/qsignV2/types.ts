export type QSignAlgo = "HMAC-SHA256" | "Ed25519";
export type QSignKeyStatus = "active" | "retired";
export type QSignGeoSource = "ip" | "gps";

export type QSignKeyRow = {
  id: string;
  kid: string;
  algo: QSignAlgo;
  publicKey: string | null;
  secretRef: string;
  status: QSignKeyStatus;
  notes: string | null;
  createdAt: Date;
  retiredAt: Date | null;
};

export type QSignSignatureRow = {
  id: string;
  hmacKid: string;
  ed25519Kid: string | null;
  payloadCanonical: string;
  payloadHash: string;
  signatureHmac: string;
  signatureEd25519: string | null;
  signatureDilithium: string | null;
  algoVersion: string;
  issuerUserId: string | null;
  issuerEmail: string | null;
  geoLat: number | null;
  geoLng: number | null;
  geoSource: QSignGeoSource | null;
  geoCountry: string | null;
  geoCity: string | null;
  createdAt: Date;
  revokedAt: Date | null;
};

export type QSignRevocationRow = {
  id: string;
  signatureId: string;
  reason: string;
  causalSignatureId: string | null;
  revokerUserId: string | null;
  revokedAt: Date;
};

export type QSignVerifyResult = {
  valid: boolean;
  signatureId?: string;
  algoVersion: string;
  hmac: { kid: string; valid: boolean };
  ed25519: { kid: string | null; valid: boolean | null };
  revoked: boolean;
  revokedAt: string | null;
  revocationReason: string | null;
  createdAt: string | null;
  payloadHash: string;
  issuer: { userId: string | null; email: string | null } | null;
  geo: {
    source: QSignGeoSource | null;
    country: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
};
