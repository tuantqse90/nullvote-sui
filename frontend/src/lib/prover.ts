// Main-thread wrapper around the proof-gen Web Worker.
//
// Call graph:
//   generateVoteProof(inputs)  →  worker.postMessage({type:'prove', inputs})
//                              ←  worker.onmessage({type:'done', proofBytes, publicBytes})
//
// The worker itself imports snarkjs + poseidon-lite; the main thread stays
// small so proof gen doesn't freeze the UI.

import ProverWorker from '../workers/prover.worker?worker'

export interface VoteCircuitInput {
  // Private
  sk: string
  r: string
  path_elements: string[]
  path_indices: string[]
  vote: string
  // Public
  root: string
  nullifier: string
  election_id: string
  vote_public: string
  num_candidates: string
}

export interface ProverResult {
  proofBytes: Uint8Array
  publicBytes: Uint8Array
  elapsedMs: number
}

type ProgressHandler = (stage: 'witness' | 'prove' | 'serialize', elapsedMs: number) => void

export function generateVoteProof(
  input: VoteCircuitInput,
  onProgress?: ProgressHandler,
): Promise<ProverResult> {
  return new Promise((resolve, reject) => {
    const worker = new ProverWorker()
    const started = performance.now()

    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data
      if (msg.type === 'progress' && onProgress) {
        onProgress(msg.stage, msg.elapsedMs)
      } else if (msg.type === 'done') {
        worker.terminate()
        resolve({
          proofBytes: new Uint8Array(msg.proofBytes),
          publicBytes: new Uint8Array(msg.publicBytes),
          elapsedMs: performance.now() - started,
        })
      } else if (msg.type === 'error') {
        worker.terminate()
        reject(new Error(msg.message ?? 'unknown prover error'))
      }
    }

    worker.onerror = (err) => {
      worker.terminate()
      reject(new Error(err.message || 'worker error'))
    }

    worker.postMessage({ type: 'prove', input })
  })
}
