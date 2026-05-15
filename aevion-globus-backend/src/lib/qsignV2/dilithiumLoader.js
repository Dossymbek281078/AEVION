'use strict';

// CJS shim — bridges to ESM-only `@noble/post-quantum`. Lives in plain
// JS so neither tsc (module: commonjs would lower import() → require())
// nor vitest's transformer touches the dynamic import() call. The path
// is a literal constant — no user input flows here.

exports.loadMlDsa = function loadMlDsa() {
  return import('@noble/post-quantum/ml-dsa.js');
};
