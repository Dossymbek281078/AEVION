// Preloaded into every smoke child by all-smokes.js (via --require). Wraps the
// global fetch so a single transient network blip to prod (connection reset,
// timeout, status 0) doesn't turn an otherwise-passing smoke into a false FAIL.
//
// Only idempotent GET/HEAD requests are retried — never POST/PUT/PATCH/DELETE,
// to avoid double-writing on a request that may have actually landed.
const origFetch = globalThis.fetch;

if (typeof origFetch === "function" && !globalThis.__fetchRetryInstalled) {
  globalThis.__fetchRetryInstalled = true;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // On retry, replace a possibly-already-fired AbortSignal (smokes commonly
  // pass AbortSignal.timeout(...), which is single-use) with a fresh timeout.
  function freshInit(init) {
    if (!init) return { signal: AbortSignal.timeout(12000) };
    const ni = Object.assign({}, init);
    if (ni.signal) ni.signal = AbortSignal.timeout(12000);
    return ni;
  }

  globalThis.fetch = async function fetchWithRetry(input, init) {
    const method = ((init && init.method) || "GET").toUpperCase();
    const retryable = method === "GET" || method === "HEAD";
    try {
      const res = await origFetch(input, init);
      if (retryable && res && res.status === 0) {
        await sleep(600);
        return await origFetch(input, freshInit(init));
      }
      return res;
    } catch (e) {
      if (!retryable) throw e;
      await sleep(600);
      // One retry only — let a second failure propagate as the real result.
      return await origFetch(input, freshInit(init));
    }
  };
}
