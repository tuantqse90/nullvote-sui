// Sanity check: our JS groth16 byte serializer must produce identical output
// to the Rust converter at circuits/scripts/export_vk_rs. Run with Node 22+:
//
//   node --experimental-strip-types scripts/verify_groth16_bytes.mjs
//
// Exits non-zero on any mismatch.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  serializeProofPoints,
  serializePublicInputs,
} from '../src/lib/groth16_bytes.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BUILD = resolve(__dirname, '../../circuits/build')

const proofJson = JSON.parse(readFileSync(`${BUILD}/proof.json`, 'utf8'))
const publicJson = JSON.parse(readFileSync(`${BUILD}/public.json`, 'utf8'))
const expectedProof = new Uint8Array(readFileSync(`${BUILD}/proof_points.bin`))
const expectedPublic = new Uint8Array(readFileSync(`${BUILD}/public_inputs.bin`))

const actualProof = serializeProofPoints(proofJson)
const actualPublic = serializePublicInputs(publicJson)

function compare(label, a, b) {
  const ok = a.length === b.length && a.every((x, i) => x === b[i])
  console.log(
    ok
      ? `✓ ${label} matches (${a.length} bytes)`
      : `✗ ${label} MISMATCH (js=${a.length}, rs=${b.length})`,
  )
  if (!ok) process.exit(1)
}

compare('proof_points', actualProof, expectedProof)
compare('public_inputs', actualPublic, expectedPublic)
