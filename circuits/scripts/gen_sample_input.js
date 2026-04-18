#!/usr/bin/env node
// Generate a valid input vector for vote.circom.
// Creates 3 simulated voters, builds a depth-8 Poseidon Merkle tree, picks
// voter 0, computes their authentication path, derives the nullifier for a
// fixed election id, and writes circuits/inputs/sample_input.json matching
// the signal names in vote.circom.

import { poseidon1, poseidon2 } from 'poseidon-lite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../inputs/sample_input.json');

const DEPTH = 8; // must match `Vote(8)` in vote.circom
const ELECTION_ID = 0x1234567890abcdefn;
const VOTE = 1n;           // YES
const NUM_CANDIDATES = 2n; // [NO, YES]

// 31-byte randoms are always < BN254 scalar prime, which is ~254 bits.
function randField() {
  return BigInt('0x' + randomBytes(31).toString('hex'));
}

function buildTree(leaves, depth) {
  const size = 1 << depth;
  const layer0 = [...leaves];
  while (layer0.length < size) layer0.push(0n);

  const layers = [layer0];
  for (let level = 0; level < depth; level++) {
    const prev = layers[level];
    const next = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(poseidon2([prev[i], prev[i + 1]]));
    }
    layers.push(next);
  }
  return layers;
}

function getProof(layers, leafIndex, depth) {
  const path_elements = [];
  const path_indices = [];
  let idx = leafIndex;
  for (let level = 0; level < depth; level++) {
    const isRight = idx % 2;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    path_elements.push(layers[level][siblingIdx]);
    path_indices.push(BigInt(isRight));
    idx = Math.floor(idx / 2);
  }
  return { path_elements, path_indices };
}

// ── Voters ──────────────────────────────────────────────
const voters = Array.from({ length: 3 }, () => {
  const sk = randField();
  const r = randField();
  const pk = poseidon1([sk]);
  const commitment = poseidon2([pk, r]);
  return { sk, r, pk, commitment };
});

const leaves = voters.map((v) => v.commitment);
const layers = buildTree(leaves, DEPTH);
const root = layers[DEPTH][0];

// ── Pick voter 0 ────────────────────────────────────────
const voterIdx = 0;
const voter = voters[voterIdx];
const { path_elements, path_indices } = getProof(layers, voterIdx, DEPTH);
const nullifier = poseidon2([voter.sk, ELECTION_ID]);

const input = {
  // Private
  sk: voter.sk.toString(),
  r: voter.r.toString(),
  path_elements: path_elements.map((x) => x.toString()),
  path_indices: path_indices.map((x) => x.toString()),
  vote: VOTE.toString(),
  // Public
  root: root.toString(),
  nullifier: nullifier.toString(),
  election_id: ELECTION_ID.toString(),
  vote_public: VOTE.toString(),
  num_candidates: NUM_CANDIDATES.toString(),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(input, null, 2));

console.log('█ Wrote', OUT);
console.log('  voters:    ', voters.length);
console.log('  depth:     ', DEPTH);
console.log('  voterIdx:  ', voterIdx);
console.log('  vote:      ', VOTE.toString(), '(yes)');
console.log('  election:  ', '0x' + ELECTION_ID.toString(16));
console.log('  root:      ', '0x' + root.toString(16));
console.log('  commitment:', '0x' + voter.commitment.toString(16));
console.log('  nullifier: ', '0x' + nullifier.toString(16));
