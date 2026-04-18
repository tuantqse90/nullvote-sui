import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit'

import WalletGate from '../components/WalletGate'
import ProofProgress from '../components/ProofProgress'
import {
  bigintToHex32,
  computeNullifier,
  hexToBigint,
} from '../lib/crypto'
import { fetchMerkleProof } from '../lib/backend'
import { generateVoteProof, type VoteCircuitInput } from '../lib/prover'
import {
  buildCastVoteTx,
  fetchElection,
  type ElectionView,
} from '../lib/sui'

type Status =
  | { kind: 'idle' }
  | { kind: 'fetching-proof' }
  | { kind: 'proving'; elapsedMs: number }
  | { kind: 'awaiting-wallet' }
  | { kind: 'done'; digest: string }
  | { kind: 'error'; message: string }

interface Identity {
  sk: string
  r: string
  commitment: string
  address: string
}

export default function Vote() {
  const { id = '' } = useParams<{ id: string }>()
  const suiClient = useSuiClient()
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()

  const [election, setElection] = useState<ElectionView | null>(null)
  const [loadingElection, setLoadingElection] = useState(true)
  const [choice, setChoice] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoadingElection(true)
      const view = await fetchElection(suiClient, id)
      if (alive) {
        setElection(view)
        setLoadingElection(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [suiClient, id])

  const identity = useMemo<Identity | null>(() => {
    const raw = localStorage.getItem(`nullvote:identity:${id}`)
    if (!raw) return null
    try {
      return JSON.parse(raw) as Identity
    } catch {
      return null
    }
  }, [id])

  async function onVote() {
    if (!election) return
    if (choice === null) return
    if (!identity) {
      setStatus({
        kind: 'error',
        message: 'No local identity found — register first on this device.',
      })
      return
    }

    try {
      setStatus({ kind: 'fetching-proof' })
      const merkleProof = await fetchMerkleProof(id, identity.commitment)

      const sk = hexToBigint(identity.sk)
      const r = hexToBigint(identity.r)
      const electionId = election.electionId
      const nullifier = computeNullifier(sk, electionId)

      const input: VoteCircuitInput = {
        sk: sk.toString(),
        r: r.toString(),
        path_elements: merkleProof.path_elements.map((x) => hexToBigint(x).toString()),
        path_indices: merkleProof.path_indices.map(String),
        vote: String(choice),
        root: hexToBigint(merkleProof.root).toString(),
        nullifier: nullifier.toString(),
        election_id: electionId.toString(),
        vote_public: String(choice),
        num_candidates: String(election.candidates.length),
      }

      setStatus({ kind: 'proving', elapsedMs: 0 })
      const proverStart = performance.now()
      const tick = setInterval(() => {
        setElapsedMs(performance.now() - proverStart)
      }, 100)

      const { proofBytes, publicBytes } = await generateVoteProof(input)
      clearInterval(tick)
      setElapsedMs(performance.now() - proverStart)

      setStatus({ kind: 'awaiting-wallet' })
      const tx = buildCastVoteTx({
        electionObject: id,
        proofBytes,
        publicInputsBytes: publicBytes,
      })
      const result = await signAndExecute({ transaction: await tx.toJSON() })

      setStatus({ kind: 'done', digest: result.digest })
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 md:py-10 space-y-8 md:space-y-10">
      <div>
        <p className="phase-marker mb-4">
          <span className="text-accent">█</span>
          <span>phase 02 — voting</span>
        </p>
        <h1 className="text-2xl md:text-h3 text-text-primary mb-3 break-words">
          {election?.title ?? (loadingElection ? 'Loading election…' : 'Election not found')}
        </h1>
        <p className="text-text-secondary">
          Election{' '}
          <code className="hash">{bigintToHex32(election?.electionId ?? 0n).slice(0, 18)}…</code>
          {election ? ` · ${election.candidates.length} candidates` : null}
        </p>
      </div>

      <WalletGate>
        {({ address: _ }) => {
          if (loadingElection) {
            return (
              <div className="card">
                <p className="text-text-secondary">Loading election state…</p>
              </div>
            )
          }
          if (!election) {
            return (
              <div className="card">
                <p className="text-danger">Could not load election object.</p>
              </div>
            )
          }
          return (
            <div className="card space-y-6">
              <fieldset className="space-y-3">
                <legend className="text-xs text-text-muted font-mono uppercase mb-2">
                  Choose a candidate
                </legend>
                {election.candidates.map((name, i) => (
                  <label
                    key={name}
                    className={`flex items-center gap-3 p-4 rounded-md border cursor-pointer transition-colors ${
                      choice === i
                        ? 'border-accent bg-accent-subtle text-text-primary'
                        : 'border-bg-raised hover:border-bg-high'
                    }`}
                  >
                    <input
                      type="radio"
                      name="candidate"
                      value={i}
                      checked={choice === i}
                      onChange={() => setChoice(i)}
                      className="accent-[#E0FF32]"
                    />
                    <span className="font-display text-lg">{name}</span>
                  </label>
                ))}
              </fieldset>

              <button
                className="btn-primary"
                onClick={onVote}
                disabled={
                  choice === null ||
                  status.kind === 'fetching-proof' ||
                  status.kind === 'proving' ||
                  status.kind === 'awaiting-wallet'
                }
              >
                {status.kind === 'fetching-proof'
                  ? 'Fetching Merkle proof…'
                  : status.kind === 'proving'
                    ? 'Generating ZK proof…'
                    : status.kind === 'awaiting-wallet'
                      ? 'Awaiting wallet…'
                      : status.kind === 'done'
                        ? 'Vote cast ✓'
                        : 'Generate proof & cast vote →'}
              </button>

              {(status.kind === 'proving' || status.kind === 'done' || status.kind === 'error') && (
                <ProofProgress
                  state={
                    status.kind === 'proving'
                      ? 'generating'
                      : status.kind === 'done'
                        ? 'done'
                        : 'error'
                  }
                  elapsedMs={elapsedMs}
                  errorMessage={status.kind === 'error' ? status.message : undefined}
                />
              )}

              {status.kind === 'done' ? (
                <div className="space-y-2 border-t border-bg-raised pt-4">
                  <div className="text-xs text-text-muted font-mono uppercase">
                    Transaction digest
                  </div>
                  <a
                    href={`https://suiscan.xyz/testnet/tx/${status.digest}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hash hover:text-accent transition-colors break-all"
                  >
                    {status.digest}
                  </a>
                </div>
              ) : null}
            </div>
          )
        }}
      </WalletGate>
    </div>
  )
}
