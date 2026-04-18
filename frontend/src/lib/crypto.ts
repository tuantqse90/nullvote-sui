// BN254 Poseidon wrappers matching circuits/vote.circom semantics.
//
// sk  = Poseidon(sig_bytes_as_bigint)    — derived locally, NEVER leaves device
// pk  = Poseidon(sk)
// C   = Poseidon(pk, r)                   — commitment published during registration
// N   = Poseidon(sk, election_id)         — nullifier published at vote time

import { poseidon1, poseidon2 } from 'poseidon-lite'

export const BN254_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n

export function hexToBigint(hex: string): bigint {
  const h = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex
  return h.length === 0 ? 0n : BigInt('0x' + h)
}

export function bigintToHex32(n: bigint): string {
  return '0x' + (n % BN254_FIELD).toString(16).padStart(64, '0')
}

export function signatureToSk(signatureBytes: Uint8Array): bigint {
  // Fold the signature into a single field element. poseidon-lite's t=3
  // Poseidon can't consume 64+ bytes directly so we split into 32-byte halves
  // and hash them together — matches the convention used by gen_sample_input.js
  // for test inputs (where we derive `sk` from a random 31-byte value).
  if (signatureBytes.length === 0) throw new Error('signatureToSk: empty bytes')

  const half = Math.ceil(signatureBytes.length / 2)
  const lo = bytesToBigint(signatureBytes.slice(0, half))
  const hi = bytesToBigint(signatureBytes.slice(half))
  return poseidon2([lo % BN254_FIELD, hi % BN254_FIELD])
}

function bytesToBigint(bytes: Uint8Array): bigint {
  // Treat bytes as big-endian (Sui wallet signatures are).
  let n = 0n
  for (const b of bytes) n = (n << 8n) | BigInt(b)
  return n
}

export function derivePk(sk: bigint): bigint {
  return poseidon1([sk])
}

export function computeCommitment(pk: bigint, r: bigint): bigint {
  return poseidon2([pk, r])
}

export function computeNullifier(sk: bigint, electionId: bigint): bigint {
  return poseidon2([sk, electionId])
}

export function randomR(): bigint {
  // 31-byte random always < field prime, simpler than rejection sampling.
  const bytes = new Uint8Array(31)
  crypto.getRandomValues(bytes)
  return bytesToBigint(bytes)
}

/** Domain-separated string used when asking the wallet to sign — ensures one
 *  election's derived `sk` is unusable in another, even with the same signer. */
export function signPayloadForElection(electionIdHex: string): string {
  return `NullVote register: ${electionIdHex}`
}
