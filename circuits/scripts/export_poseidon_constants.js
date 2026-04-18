#!/usr/bin/env node
// Dump circomlib Poseidon constants (C = round constants, M = MDS matrix) to a
// JSON file consumable by the Python port in backend/src/crypto/poseidon.py.
//
// Source of truth: circomlibjs/src/poseidon_constants.json (same team as circomlib).
// Indexing matches circomlibjs reference implementation: CONSTANTS[t - 2] for state size t.
// For nInputs-input Poseidon, t = nInputs + 1 (state[0] is capacity).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CONSTANTS_SRC = resolve(
  __dirname,
  '../node_modules/circomlibjs/src/poseidon_constants.json',
);
const OUT_PATH = resolve(
  __dirname,
  '../../backend/src/crypto/poseidon_constants.json',
);

const BN254_SCALAR_FIELD =
  '21888242871839275222246405745257275088548364400416034343698204186575808495617';

// Round counts hard-coded in circomlib's poseidon.circom — index by (t - 2).
const N_ROUNDS_F = 8;
const N_ROUNDS_P = [56, 57, 56, 60, 60, 63, 64, 63, 60, 66, 60, 65, 70, 60, 64, 68];

const src = JSON.parse(readFileSync(CONSTANTS_SRC, 'utf8'));

const perT = {};
for (let t = 2; t <= 17; t++) {
  const idx = t - 2;
  const C = src.C[idx];
  const M = src.M[idx];
  if (!Array.isArray(C) || !Array.isArray(M)) {
    throw new Error(`missing constants for t=${t}`);
  }
  const expectedC = (N_ROUNDS_F + N_ROUNDS_P[idx]) * t;
  if (C.length !== expectedC) {
    throw new Error(`t=${t}: expected ${expectedC} C entries, got ${C.length}`);
  }
  if (M.length !== t || M.some((row) => row.length !== t)) {
    throw new Error(`t=${t}: MDS matrix not ${t}x${t}`);
  }
  perT[t] = { C, M };
}

const payload = {
  _source: 'circomlibjs/src/poseidon_constants.json',
  _note:
    'Indexing by state size t. For nInputs-input Poseidon use t = nInputs + 1.',
  prime: BN254_SCALAR_FIELD,
  n_rounds_f: N_ROUNDS_F,
  n_rounds_p: N_ROUNDS_P,
  per_t: perT,
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));

console.log(`Wrote ${OUT_PATH}`);
console.log(`  t range: 2..17`);
console.log(`  C entries (t=3): ${perT[3].C.length}`);
console.log(`  M dim (t=3):     ${perT[3].M.length}x${perT[3].M[0].length}`);
