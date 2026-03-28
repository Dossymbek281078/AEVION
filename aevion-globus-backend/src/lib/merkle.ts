import crypto from "crypto";

export function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Deterministic binary Merkle tree: leaves sorted lexicographically.
 * Odd last node pairs with itself.
 */
export function buildMerkleTree(sortedLeafHashes: string[]): { root: string; layers: string[][] } {
  if (sortedLeafHashes.length === 0) {
    return { root: sha256Hex("planet:empty_vote_tree"), layers: [[sha256Hex("planet:empty_vote_tree")]] };
  }

  let layer = [...sortedLeafHashes];
  const layers: string[][] = [layer];

  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : layer[i];
      next.push(sha256Hex(`${left}|${right}`));
    }
    layer = next;
    layers.push(layer);
  }

  return { root: layer[0], layers };
}

export function merkleProofForLeaf(sortedLeafHashes: string[], leafHash: string): string[] | null {
  const idx = sortedLeafHashes.indexOf(leafHash);
  if (idx < 0) return null;

  const { layers } = buildMerkleTree(sortedLeafHashes);
  const proof: string[] = [];
  let index = idx;

  for (let level = 0; level < layers.length - 1; level++) {
    const row = layers[level];
    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : index + 1;
    const sibling = siblingIndex < row.length ? row[siblingIndex] : row[index];
    proof.push(sibling);
    index = Math.floor(index / 2);
  }

  return proof;
}

/** Verify proof produced by merkleProofForLeaf against root from buildMerkleTree(sortedLeaves). */
export function verifyMerkleProof(leafHash: string, proof: string[], root: string, leafIndex: number): boolean {
  let idx = leafIndex;
  let acc = leafHash;
  for (const sibling of proof) {
    const isRight = idx % 2 === 1;
    acc = isRight ? sha256Hex(`${sibling}|${acc}`) : sha256Hex(`${acc}|${sibling}`);
    idx = Math.floor(idx / 2);
  }
  return acc === root;
}

export function sortedIndex(sortedLeaves: string[], leafHash: string): number {
  return sortedLeaves.indexOf(leafHash);
}
