// Minimal ambient declaration — upstream ships no TS types.
// We treat the whole surface as `any`; the thin wrapper in anchor.ts
// is responsible for narrowing back to sane types.
declare module "opentimestamps";
