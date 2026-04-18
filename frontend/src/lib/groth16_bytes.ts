// Serialize snarkjs groth16 proof + public inputs to the arkworks-canonical
// compressed byte layout that `sui::groth16::{proof_points_from_bytes,
// public_proof_inputs_from_bytes}` expects.
//
// This mirrors the Rust converter at circuits/scripts/export_vk_rs/src/main.rs
// — if you change one, change both. A round-trip test lives in
// src/lib/__tests__/groth16_bytes.test.ts (verify against the committed
// proof_points.bin + public_inputs.bin for the sample input).

// BN254 base field prime (Fq, not the scalar Fr).
const BN254_Q =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n
const BN254_Q_HALF = BN254_Q / 2n

// BN254 scalar field prime (Fr).
const BN254_R =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n

const SW_FLAG_POSITIVE_Y = 0b1000_0000
const SW_FLAG_INFINITY = 0b0100_0000

function intToLEBytes32(n: bigint): Uint8Array {
  const out = new Uint8Array(32)
  let x = n
  for (let i = 0; i < 32; i++) {
    out[i] = Number(x & 0xffn)
    x >>= 8n
  }
  return out
}

function parseFq(s: string): bigint {
  // snarkjs stores points as decimal strings; %q normalizes range.
  return BigInt(s) % BN254_Q
}

function parseFr(s: string): bigint {
  return BigInt(s) % BN254_R
}

/** arkworks CompressedFlags: y is "positive" iff y > (q-1)/2. */
function isPositiveY(y: bigint): boolean {
  return y > BN254_Q_HALF
}

/** G1 affine compressed: 32 bytes (x LE) with y_sign / infinity flags in the
 *  top 2 bits of byte[31]. */
function serializeG1(x: bigint, y: bigint): Uint8Array {
  if (x === 0n && y === 0n) {
    const out = new Uint8Array(32)
    out[31] = SW_FLAG_INFINITY
    return out
  }
  const bytes = intToLEBytes32(x)
  if (isPositiveY(y)) bytes[31] |= SW_FLAG_POSITIVE_Y
  return bytes
}

/** G2 affine compressed: 64 bytes — x.c0 (32 LE) || x.c1 (32 LE) — flags on
 *  byte[63]. "Positive y" for Fp2 is determined lexicographically on (c1, c0)
 *  against the corresponding halves of -y. */
function serializeG2(
  xC0: bigint,
  xC1: bigint,
  yC0: bigint,
  yC1: bigint,
): Uint8Array {
  const isInfinity = xC0 === 0n && xC1 === 0n && yC0 === 0n && yC1 === 0n
  const bytes = new Uint8Array(64)
  bytes.set(intToLEBytes32(xC0), 0)
  bytes.set(intToLEBytes32(xC1), 32)
  if (isInfinity) {
    bytes[63] = SW_FLAG_INFINITY
    return bytes
  }
  const yPositive = isPositiveYFp2(yC0, yC1)
  if (yPositive) bytes[63] |= SW_FLAG_POSITIVE_Y
  return bytes
}

/** y > -y in Fp2 under lex order on (c1, c0):
 *    y.c1 > (q - y.c1) first, falling back to y.c0 > (q - y.c0) when c1 ties.
 *  Equivalent to: y.c1 > q/2, else (y.c1 == 0 && y.c0 > q/2).
 *  (-y.c1 = q - y.c1; y.c1 != -y.c1 when y.c1 != 0 since q is odd.)
 */
function isPositiveYFp2(c0: bigint, c1: bigint): boolean {
  if (c1 > BN254_Q_HALF) return true
  if (c1 === 0n) return c0 > BN254_Q_HALF
  return false
}

export interface SnarkjsProof {
  pi_a: [string, string, string]
  pi_b: [[string, string], [string, string], [string, string]]
  pi_c: [string, string, string]
  protocol: string
  curve: string
}

/** snarkjs → arkworks compressed (A || B || C), 128 bytes for BN254. */
export function serializeProofPoints(proof: SnarkjsProof): Uint8Array {
  const aX = parseFq(proof.pi_a[0])
  const aY = parseFq(proof.pi_a[1])

  // snarkjs exposes Fp2 as [c0, c1] (same convention as arkworks BN254).
  const bXc0 = parseFq(proof.pi_b[0][0])
  const bXc1 = parseFq(proof.pi_b[0][1])
  const bYc0 = parseFq(proof.pi_b[1][0])
  const bYc1 = parseFq(proof.pi_b[1][1])

  const cX = parseFq(proof.pi_c[0])
  const cY = parseFq(proof.pi_c[1])

  const aBytes = serializeG1(aX, aY)
  const bBytes = serializeG2(bXc0, bXc1, bYc0, bYc1)
  const cBytes = serializeG1(cX, cY)

  const out = new Uint8Array(aBytes.length + bBytes.length + cBytes.length)
  out.set(aBytes, 0)
  out.set(bBytes, aBytes.length)
  out.set(cBytes, aBytes.length + bBytes.length)
  return out
}

/** N × 32-byte LE scalars concatenated, matching
 *  sui::groth16::public_proof_inputs_from_bytes. */
export function serializePublicInputs(publicDec: string[]): Uint8Array {
  const out = new Uint8Array(publicDec.length * 32)
  for (let i = 0; i < publicDec.length; i++) {
    const fr = parseFr(publicDec[i])
    out.set(intToLEBytes32(fr), i * 32)
  }
  return out
}

export function toHex(bytes: Uint8Array): string {
  let s = '0x'
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}
