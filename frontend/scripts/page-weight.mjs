/**
 * Prints how much JavaScript a page must download before it can answer a tap.
 *
 * Counts only the `<script src>` tags in the HTML the server actually sends —
 * the bytes that stand between the page appearing and the page working. Lazy
 * chunks that arrive afterwards are deliberately excluded; mixing the two is
 * how an earlier comparison of the two bundlers came out wrong.
 *
 * Usage, against a running `next start`:
 *   node scripts/page-weight.mjs http://127.0.0.1:3187 / /devhub /compare
 */

const [base, ...paths] = process.argv.slice(2);

if (!base || paths.length === 0) {
  console.error("usage: node scripts/page-weight.mjs <baseUrl> <path> [path...]");
  process.exit(2);
}

for (const path of paths) {
  const html = await (await fetch(new URL(path, base))).text();
  const srcs = [
    ...new Set(
      [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((s) => s.startsWith("/")),
    ),
  ];

  // Both numbers matter and they are not interchangeable: the compressed one is
  // what a phone waits for on the wire, the decoded one is what it then has to
  // parse. Comparing a compressed figure against a decoded one is exactly how an
  // earlier bundler comparison came out wrong.
  let decoded = 0;
  let wire = 0;
  for (const src of srcs) {
    const res = await fetch(new URL(src, base), {
      headers: { "Accept-Encoding": "br, gzip" },
    });
    decoded += (await res.clone().arrayBuffer()).byteLength;
    const len = res.headers.get("content-length");
    // No content-length means the body was streamed uncompressed; then the
    // decoded size is the transfer size.
    wire += len ? Number(len) : (await res.arrayBuffer()).byteLength;
  }

  const kb = (n) => String(Math.round(n / 1024)).padStart(6);
  console.log(
    `${path.padEnd(12)} ${kb(wire)} KB over the wire, ${kb(decoded)} KB decoded, ${srcs.length} files`,
  );
}
