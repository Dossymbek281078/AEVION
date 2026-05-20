# PUBLISH-CHECKLIST — @aevion-io/catalog-client

Pre-flight checklist for an npm publish of `@aevion-io/catalog-client`.
Run from `packages/aevion-catalog-client/` unless stated otherwise.

> **Requires `NPM_TOKEN` env var** (Automation token, scope: `@aevion`, publish rights).
> Or interactive `npm login` with 2FA OTP on the publishing machine.
> Without it, `npm publish` will fail with `ENEEDAUTH`.

---

## 1. Pre-flight checklist

- [ ] **tsc clean** — `npm run build` exits 0, no TS errors
- [ ] **vitest pass** — `npm test` (or `npm run test:run`) all specs PASS
- [ ] **CHANGELOG updated** — new version section in `CHANGELOG.md` with bullet list of changes
- [ ] **README has Install + Usage** — both sections present, code samples compile
- [ ] **version bumped** — `package.json` `version` matches the new tag (e.g. `0.7.0`)
- [ ] **dist/ generated** — `dist/index.js` and `dist/index.d.ts` exist after `npm run build`
- [ ] **dry-run** — `npm publish --dry-run --access public` shows expected file list
- [ ] **verify tarball** — `npm pack` produces `aevion-catalog-client-<v>.tgz`, inspect it
- [ ] **NPM_TOKEN set** OR `npm login` completed (one-time, requires 2FA)
- [ ] **Real publish** — `npm publish --access public --provenance`
- [ ] **Verify on npmjs.org** — https://www.npmjs.com/package/@aevion-io/catalog-client shows new version
- [ ] **Git tag** — `catalog-client-v<version>` pushed to origin
- [ ] **Smoke install** — in a clean dir: `npm i @aevion-io/catalog-client && node -e "console.log(require('@aevion-io/catalog-client'))"`

---

## 2. Commands (run by parent agent)

### 2.1 Build + test (sanity)

```bash
cd packages/aevion-catalog-client

# Install dev deps if not yet
npm install

# Compile TypeScript -> dist/
npm run build

# Run all tests
npm run test:run
```

Expected: zero TS errors; vitest green; `dist/index.js` + `dist/index.d.ts` present.

### 2.2 Dry-run (does NOT publish)

```bash
# Show what WOULD be published — file list + size + tag
npm publish --dry-run --access public

# Generate the tarball locally and inspect it
npm pack
tar -tzf aevion-catalog-client-0.7.0.tgz
```

Expected tarball contents (whitelisted via `files` in package.json):

```
package/dist/index.js
package/dist/index.d.ts
package/dist/index.js.map         (if sourcemaps enabled)
package/README.md
package/CHANGELOG.md
package/LICENSE                   (if present)
package/package.json
```

Should be **< 50 kB**. No `src/`, no `__tests__/`, no `examples/`, no `tsconfig.json`,
no `vitest.config.ts`, no `package-lock.json`.

### 2.3 Authentication (one-time per machine)

**Option A — interactive login (recommended for laptop):**
```bash
npm login
# enter username, password, OTP
npm whoami   # verify
```

**Option B — NPM_TOKEN env var (CI / scripted):**
```bash
# Set in environment (NOT in shell history):
export NPM_TOKEN="npm_xxxxxxxxxxxxxxxxxxxxxxxx"

# Tell npm to use it (writes to ~/.npmrc):
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> ~/.npmrc

# Verify
npm whoami
```

> Token must be **Automation** type (bypasses 2FA OTP) and have publish rights on the `@aevion` scope.

### 2.4 Real publish

```bash
cd packages/aevion-catalog-client
npm publish --access public --provenance
```

`--access public`  — required for scoped public packages.
`--provenance`     — signs the publish via GitHub Actions OIDC (only works in CI; remove on laptop).

For a manual laptop publish, drop `--provenance`:
```bash
npm publish --access public
```

### 2.5 Post-publish verification

```bash
# 1. Web view
open https://www.npmjs.com/package/@aevion-io/catalog-client

# 2. Install in a fresh sandbox
mkdir /tmp/aevion-sdk-smoke && cd /tmp/aevion-sdk-smoke
npm init -y
npm i @aevion-io/catalog-client
node -e "const { AevionCatalog } = require('@aevion-io/catalog-client'); console.log(typeof AevionCatalog);"
# expected: "function"

# 3. Tag the release in git
cd -   # back to repo
git tag catalog-client-v0.7.0
git push origin catalog-client-v0.7.0
```

---

## 3. Rollback (if publish was a mistake)

npm allows `unpublish` only within **72 hours** of publish:

```bash
npm unpublish @aevion-io/catalog-client@0.7.0
```

After 72 hours, you MUST publish a patch instead (e.g. `0.7.1`).
**Never** republish the same version — npm rejects it and the cache may be poisoned.

If the package is broken but can't be unpublished, deprecate it:

```bash
npm deprecate @aevion-io/catalog-client@0.7.0 "Broken release, use 0.7.1+"
```

---

## 4. Notes

- `prepublishOnly` hook runs `npm run build && npm run test:run` automatically before every
  `npm publish` — if either fails, publish is aborted. Do not rely on it as the only gate; run
  the steps in §2.1 manually first to see errors quickly.
- The `files` whitelist in `package.json` (`dist`, `README.md`, `CHANGELOG.md`, `LICENSE`) is the
  primary publish filter. `.npmignore` is a redundant safety net.
- Package-lock is intentionally NOT committed — only devDependencies, lockfile-less is fine.
- For CI-driven publish on tag `catalog-client-v*`, see `PUBLISHING.md` and
  `.github/workflows/publish-catalog-client.yml`.
