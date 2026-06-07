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

  // Escalating backoff across attempts. Two retries (3 attempts total) absorbs
  // Railway cold-starts, where the first request wakes a sleeping instance and
  // can exceed the per-call timeout before it's warm.
  const BACKOFFS = [600, 1500];

  globalThis.fetch = async function fetchWithRetry(input, init) {
    const method = ((init && init.method) || "GET").toUpperCase();
    const retryable = method === "GET" || method === "HEAD";
    let lastErr;
    for (let attempt = 0; attempt <= BACKOFFS.length; attempt++) {
      const thisInit = attempt === 0 ? init : freshInit(init);
      try {
        const res = await origFetch(input, thisInit);
        // status 0 (opaque/aborted) is treated like a transient failure.
        if (retryable && res && res.status === 0 && attempt < BACKOFFS.length) {
          await sleep(BACKOFFS[attempt]);
          continue;
        }
        return res;
      } catch (e) {
        lastErr = e;
        if (!retryable || attempt === BACKOFFS.length) throw e;
        await sleep(BACKOFFS[attempt]);
      }
    }
    throw lastErr;
  };
}
