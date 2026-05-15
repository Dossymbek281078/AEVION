# Publishing `@aevion/catalog-client`

This document describes how to publish a new version of `@aevion/catalog-client` to npm.

## Prerequisites

- **npm account** with publish rights on the `@aevion` scope. Run `npm login` once on the publishing machine.
- **2FA enabled** on the npm account (required for scoped public packages).
- **`NPM_TOKEN`** secret configured in the GitHub repo for CI-driven publishes. Token must be of type "Automation" (bypasses 2FA OTP) and have publish rights on `@aevion`.
- Local Node.js `>=18` (matches the `engines` field).

## Manual publish (from a maintainer's laptop)

```bash
cd packages/aevion-catalog-client

# 1. Verify everything is clean
npm run build
npm run test:run
npm run dry-publish      # inspect file list + size

# 2. Bump version (creates a git tag automatically)
npm version patch         # or: minor / major

# 3. Push tag — CI will pick it up if the workflow is wired
git push --follow-tags

# 4. Publish (requires npm login + OTP)
npm publish --access public --provenance
```

The `prepublishOnly` script ensures `tsc` runs before every publish, so `dist/` is always fresh.

## CI-driven publish

A git tag matching `catalog-client-v*` (e.g. `catalog-client-v0.5.0`) is expected to trigger
`.github/workflows/publish-catalog-client.yml`. The workflow should:

1. Checkout + setup Node 20
2. `npm ci` inside `packages/aevion-catalog-client`
3. `npm run build` + `npm run test:run`
4. `npm publish --access public --provenance` using `NPM_TOKEN`

Use the CI path for releases — provenance is signed by GitHub Actions and shown on the npm page.

## Pre-publish checklist

- [ ] `npm run build` exits 0 with no TS errors
- [ ] `npm run test:run` — all vitest specs PASS
- [ ] `CHANGELOG.md` updated with the new version + bullet list of changes
- [ ] `README.md` "Examples" / API surface section reflects current exports
- [ ] `npm run dry-publish` shows:
  - `total files: 4` (or 5 if a `LICENSE` is added)
  - package size **< 50 kB** (currently ~8 kB)
  - no stray `src/`, `__tests__/`, `examples/`, `vitest.config.ts`, `package-lock.json`
- [ ] Version bumped via `npm version` (not hand-edited)

## Notes

- `package-lock.json` is **not** committed to the repo (listed in `.gitignore` / `.npmignore`).
  The package has only devDependencies, so a lockfile-less workflow is fine.
- The `files` field in `package.json` whitelists what gets published (`dist`, `README.md`).
  `.npmignore` is a redundant safety net so test/source/config files never leak even if
  `files` is removed.
- Public registry URL: https://www.npmjs.com/package/@aevion/catalog-client
