/// <reference lib="webworker" />
// Proof generation runs off the main thread.
//
// Loads the circuit's .wasm + .zkey from /public/circuit/ (bundled as static
// assets by Vite), runs snarkjs.groth16.fullProve, serializes the result to
// arkworks canonical compressed bytes, and posts those back to the main
// thread along with the public-input byte blob.

import { groth16 } from 'snarkjs'

import {
  serializeProofPoints,
  serializePublicInputs,
  type SnarkjsProof,
} from '../lib/groth16_bytes'

declare const self: DedicatedWorkerGlobalScope

const WASM_URL = '/circuit/vote.wasm'
const ZKEY_URL = '/circuit/vote_final.zkey'

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data
  if (msg?.type !== 'prove') return

  const started = performance.now()
  try {
    self.postMessage({ type: 'progress', stage: 'witness', elapsedMs: 0 })

    // snarkjs accepts URLs directly in the browser — it fetches them once.
    const { proof, publicSignals } = (await groth16.fullProve(
      msg.input,
      WASM_URL,
      ZKEY_URL,
    )) as { proof: SnarkjsProof; publicSignals: string[] }

    self.postMessage({
      type: 'progress',
      stage: 'serialize',
      elapsedMs: performance.now() - started,
    })

    const proofBytes = serializeProofPoints(proof)
    const publicBytes = serializePublicInputs(publicSignals)

    self.postMessage(
      {
        type: 'done',
        proofBytes: proofBytes.buffer,
        publicBytes: publicBytes.buffer,
      },
      // Transfer ownership of the ArrayBuffers — zero-copy back to main.
      { transfer: [proofBytes.buffer, publicBytes.buffer] },
    )
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
