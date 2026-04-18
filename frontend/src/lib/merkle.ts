// Client-side Merkle helpers. Normally the backend produces proofs via
// `/api/elections/:id/merkle-proof`, but we keep these as a fallback if the
// backend is unavailable and we already have the commitment list.

import { poseidon2 } from 'poseidon-lite'

export interface MerkleProof {
  pathElements: bigint[]
  pathIndices: number[]
  root: bigint
}

export function buildTree(leaves: bigint[], depth: number): bigint[][] {
  const capacity = 1 << depth
  if (leaves.length > capacity) {
    throw new Error(`too many leaves (${leaves.length}) for depth ${depth}`)
  }
  const layer0: bigint[] = [...leaves]
  while (layer0.length < capacity) layer0.push(0n)

  const layers: bigint[][] = [layer0]
  for (let level = 0; level < depth; level++) {
    const prev = layers[level]
    const next: bigint[] = []
    for (let i = 0; i < prev.length; i += 2) {
      next.push(poseidon2([prev[i], prev[i + 1]]))
    }
    layers.push(next)
  }
  return layers
}

export function getProof(layers: bigint[][], leafIndex: number): MerkleProof {
  const depth = layers.length - 1
  const pathElements: bigint[] = []
  const pathIndices: number[] = []
  let idx = leafIndex
  for (let level = 0; level < depth; level++) {
    const isRight = idx & 1
    const siblingIdx = isRight ? idx - 1 : idx + 1
    pathElements.push(layers[level][siblingIdx])
    pathIndices.push(isRight)
    idx >>= 1
  }
  return { pathElements, pathIndices, root: layers[depth][0] }
}
