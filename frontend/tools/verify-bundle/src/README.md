# Verify an AEVION delivery yourself

Three files, no dependencies, no account, no key from us. Node 18 or newer.

```
node verify-aevion.mjs manifest-sample.json          # five live records, not a delivery
node verify-aevion.mjs manifest-control-revoked.json # control: must fail
node verify-aevion.mjs --selftest                    # offline, 11 controls
```

Exit codes: **0** everything verified, **1** something failed (the reason is
printed per record), **2** it could not run at all — which is not a pass.

### The revoked control makes two different statements, on purpose

`manifest-control-revoked.json` lists two records, and the difference between
them is the point:

| record | how it is read | what its failure proves |
|---|---|---|
| `revoked-work.bin` | id only — the verifier reads the **live registry** | this signature is revoked **right now** |
| `revoked-work-snapshot.bin` | record embedded — **no network at all** | the verifier honours the revoked flag, as a **snapshot** taken on the manifest's `checkedAt` date |

Both must fail and the run must exit 1. Point `apiBase` at a dead host and you
will see the distinction: the first line says `could not fetch`, the second
still says `revoked on …`. One sentence cannot carry both claims honestly, so
we ship them as two.

## What the script actually does

It ignores the `valid` flags our API returns and recomputes everything with
Node's built-in `crypto`:

1. `payloadHash == sha256(payloadCanonical)` — the hash is honest.
2. the Ed25519 signature verifies over `payloadCanonical` (RFC 8785 canonical
   JSON) using the published 32-byte public key — the signature is ours.
3. the record is not revoked.
4. if your manifest pins a public key, every record must use that key — so we
   cannot quietly re-sign a delivery with a different one.

It takes NOTHING from us over the network: `manifest-sample.json` carries each
signed record inline under `record:`, so the delivery check runs with no network
at all (verified by pointing `apiBase` at a dead host — still 5 of 5, exit 0).
The inline copy carries the revocation state as of its `checkedAt` date; to
re-read the live registry, run `refresh-sample.mjs`, which rewrites the manifest
from whatever is live right now.

## Measured, not asserted

| run | result | measured |
|---|---|---|
| 5 live production signatures | 5 OK, exit 0 | 2026-10-09 |
| 1 revoked signature (control) | FAIL "revoked on 2026-07-27…", exit 1 | 2026-10-09 |
| offline delivery demo | 3 verified, altered file REFUSED, exit 0 | 2026-10-09 |
| offline self-test | 11 of 11 controls behaved as expected, exit 0 | 2026-10-12 |

Each row carries its own date because they age differently: the live rows
depend on what is in our registry today, the offline rows do not depend on us
at all. A row whose date is old is a row you should re-run, not trust.

The self-test is deliberately mostly negative controls — tampered payload,
tampered hash, tampered signature, swapped key, revoked, missing signature. A
verifier that approves everything is worse than no verifier.

## What this does NOT prove

* **Not the author's identity.** The signature proves the work belongs to the
  holder of the key. AEVION identity verification is a stub today (`kyc: stub`).
* **Not consent to train.** No such field exists yet; it is in design.
* **Not notarial force.** There is no notary co-signature (`notarySignature: demo`).

We would rather you read this section before the first one.

## Manifest format

```json
{
  "apiBase": "https://api.aevion.app",
  "publicKey": "63fd4f60…36b8",
  "records": [
    { "file": "work-1.bin", "id": "<signature id>" },
    { "file": "work-2.bin", "id": "<signature id>", "record": { } }
  ]
}
```

`publicKey` is optional but recommended: pinning it is what turns "this verifies"
into "this verifies against the key you were given on day one".

---

# Our side: `bundle-aevion.mjs`

The verifier answers the buyer's question. This answers ours — it turns a folder
of files into the exact payloads we sign, so what you verify is tied to the bytes
you received, not to a record that merely exists somewhere.

```
node bundle-aevion.mjs prepare <folder> --out <dir> --name <delivery>
node bundle-aevion.mjs attach  <dir> --signed <signed.json> [--api <base>]
node bundle-aevion.mjs --selftest
```

`attach` does one more thing than its name suggests: it **embeds each signed
record into the manifest**. We pay for the network once, here; the buyer then
verifies the delivery with no credentials from us — the signed record is fetched from our open endpoint, and on request we embed the records in the manifest so the check needs nothing of ours at all at all. If it cannot embed
every record it says so and exits 1 — a delivery that still needs our API is
not the delivery we promise.

`prepare` hashes every file (recursively, paths normalised to forward slashes),
writes `to-sign.json` — one canonical payload per file — and a manifest skeleton
with empty ids. It makes **no network call and signs nothing**.

`attach` merges the ids returned by signing into the manifest.

**The signing call is deliberately not in this script.** It needs a credential
and it writes to production; a tool that can quietly do both will one day do
both by accident.

## What a signed payload contains — and what it never contains

```json
{"bytes":11,"delivery":"pilot-demo","file":"a.txt","kind":"aevion.delivery.file.v1","sha256":"a8a669c2…"}
```

There is **no `author` field and no `consent` field**. We do not verify identity
today and consent-to-train is not built, so signing either would mean signing a
claim we cannot support — exactly what a signature is supposed to prevent.

## Measured end to end (2026-10-02)

| run | result |
|---|---|
| `bundle --selftest` | 11 of 11 controls as expected (key order, whitespace, a real production payload, content change, rename, no author claim) |
| `prepare` on a 2-file folder with a subdirectory | both files hashed, canonical JSON key-sorted, nested path kept as `nested/b.txt` |
| unsigned manifest fed to the verifier | refused, exit 1, "no signature id in the manifest — this delivery has not been signed" |
| `verify --selftest` | 11 of 11, including 4 controls that tie the signature to the file on disk |
| 5 live production signatures | 5 passed, exit 0 |
| 1 revoked signature | rejected with reason and date, exit 1 |

The unsigned-manifest row is the one that matters most: a verifier that answered
"OK" to a delivery nobody signed would be worse than no verifier at all.

## Tie the proof to your copy of the file

Add `localFile` to a manifest record and the verifier hashes your bytes and
compares them with the hash inside the signed payload:

```json
{ "file": "a.txt", "id": "<signature id>", "localFile": "./received/a.txt" }
```

Without it you learn that a valid signature exists. With it you learn that the
file in your hand is the signed one. Only the second statement is worth money.

---

# `demo-local.mjs` — see the format work, offline, in ten seconds

```
node demo-local.mjs
```

It builds a three-file delivery, signs it with a keypair generated on **your**
machine, verifies all three, then alters one delivered file by a single byte and
shows the same check refusing it.

🔴 **Those are not AEVION signatures.** The key is throwaway, nothing is sent
anywhere, nothing is registered, and the run proves nothing about any real work.
It demonstrates the format and the verifier — that is all it claims.

Why it is in the box: `manifest-sample.json` points at real production
signatures, but those sign small test payloads rather than file deliveries, so
they cannot show the part that matters most to a buyer — that a signature is
tied to the bytes in your hand. This shows exactly that, including the failure
case. Measured 2026-10-09: three files verified, the altered file was refused
with both hashes printed, exit 0.

The closing line of that run is the honest summary of this whole package:

> a valid signature does NOT mean the file you hold is the signed one.
> Only passing your local copy to the verifier establishes that.

---

# About `manifest-sample.json` — these are live records, not a file delivery

The five entries point at **real production signatures**, created in 2026-07 (four on 07-22, one on 07-27) and untouched since. They are not a delivery of files;
they exist so you can see the verifier agree with our live registry without us
preparing anything for you.

**If one of them is ever revoked, the verifier will fail it with the date.**
That is the verifier telling the truth, not this package breaking — and it is
worth seeing: revocation is the half most provenance claims quietly skip.

To rebuild the sample from whatever is live right now:

```
node refresh-sample.mjs --dry-run   # show what it would pick
node refresh-sample.mjs             # rewrite manifest-sample.json
node verify-aevion.mjs manifest-sample.json
```

Exit codes: 0 fine, 1 not enough live records to build a sample, 2 the registry
could not be reached — which is not the same as "fine".

---

# `sign-delivery.mjs` — our side of the signing step

```
AEVION_API_KEY=<key> node sign-delivery.mjs <delivery dir>           # one by one
AEVION_API_KEY=<key> node sign-delivery.mjs <delivery dir> --batch   # many files
node sign-delivery.mjs --selftest                                    # offline
```

It reads `to-sign.json` produced by `bundle-aevion.mjs prepare`, signs each
payload through the AEVION API and writes `signed.json` for `bundle attach`.
The key comes **only** from the environment — never put it in the command line,
where it lands in shell history and logs.

Exit codes: **0** everything signed, **1** partly signed or the key was
rejected, **2** it could not run — no key, no input, no network. 🔴 A 2 is not
"nothing happened": the delivery is unsigned.

This script is in the box so you can read what we will run against your set.
You do not need it to verify anything.
