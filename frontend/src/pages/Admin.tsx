import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit'

import WalletGate from '../components/WalletGate'
import {
  buildCreateElectionTx,
  buildFinalizeRegistrationTx,
  fetchElection,
  type ElectionView,
} from '../lib/sui'
import {
  listElectionCreatedEvents,
  type ElectionCreatedEvent,
} from '../lib/subscribe'
import { closeRegistration } from '../lib/backend'

type Status =
  | { kind: 'idle' }
  | { kind: 'executing' }
  | { kind: 'done'; electionId: string; electionObject: string; digest: string }
  | { kind: 'error'; message: string }

export default function Admin() {
  const suiClient = useSuiClient()
  const account = useCurrentAccount()
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()

  const [title, setTitle] = useState('Treasury Proposal')
  const [candidatesText, setCandidatesText] = useState('No, Yes')
  const [durationHours, setDurationHours] = useState(24)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [myElections, setMyElections] = useState<ElectionCreatedEvent[] | null>(
    null,
  )
  const [electionStates, setElectionStates] = useState<
    Record<string, ElectionView | null>
  >({})
  const [finalizeBusy, setFinalizeBusy] = useState<string | null>(null)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [finalizeTick, setFinalizeTick] = useState(0)

  // Pull all ElectionCreated events filtered to the current wallet.
  useEffect(() => {
    if (!account) {
      setMyElections(null)
      return
    }
    let alive = true
    listElectionCreatedEvents(suiClient as any, account.address)
      .then((events) => {
        if (alive) setMyElections(events)
      })
      .catch(() => {
        if (alive) setMyElections([])
      })
    return () => {
      alive = false
    }
  }, [suiClient, account, status.kind, finalizeTick])

  // Once we have the list, fetch each election's on-chain phase so we know
  // when to show the Finalize button.
  useEffect(() => {
    if (!myElections) return
    let alive = true
    ;(async () => {
      const entries = await Promise.all(
        myElections.map(async (e) => {
          try {
            const view = await fetchElection(suiClient as any, e.electionObject)
            return [e.electionObject, view] as const
          } catch {
            return [e.electionObject, null] as const
          }
        }),
      )
      if (alive) setElectionStates(Object.fromEntries(entries))
    })()
    return () => {
      alive = false
    }
  }, [myElections, suiClient, finalizeTick])

  const registrationOpen = useMemo(() => {
    const set = new Set<string>()
    for (const [id, v] of Object.entries(electionStates)) {
      if (v && v.phase === 0) set.add(id)
    }
    return set
  }, [electionStates])

  async function onFinalize(electionObject: string) {
    setFinalizeError(null)
    setFinalizeBusy(electionObject)
    try {
      const resp = await closeRegistration(electionObject, electionObject)
      if (resp.voter_count === 0) {
        throw new Error('no voters registered yet — cannot finalize')
      }
      // merkle_root comes back as 0x… hex; convert to bytes for the Move call.
      const rootHex = resp.merkle_root.startsWith('0x')
        ? resp.merkle_root.slice(2)
        : resp.merkle_root
      const rootBytes = new Uint8Array(32)
      for (let i = 0; i < 32; i++) {
        rootBytes[i] = parseInt(rootHex.slice(i * 2, i * 2 + 2), 16)
      }
      const tx = buildFinalizeRegistrationTx({
        electionObject,
        merkleRoot: rootBytes,
      })
      await signAndExecute({ transaction: await tx.toJSON() })
      setFinalizeTick((n) => n + 1)
    } catch (err) {
      setFinalizeError(err instanceof Error ? err.message : String(err))
    } finally {
      setFinalizeBusy(null)
    }
  }

  async function onCreate() {
    try {
      setStatus({ kind: 'executing' })
      const electionId = randomElectionId()
      const candidates = candidatesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const endTimeMs = BigInt(Date.now() + durationHours * 3600 * 1000)

      const tx = buildCreateElectionTx({
        electionId,
        title,
        candidates,
        endTimeMs,
      })
      const result = await signAndExecute({ transaction: await tx.toJSON() })

      const created = await (suiClient as any).getTransactionBlock({
        digest: result.digest,
        options: { showObjectChanges: true },
      })
      const electionObject: string =
        created.objectChanges?.find(
          (c: any) =>
            c.type === 'created' &&
            typeof c.objectType === 'string' &&
            c.objectType.endsWith('::election::Election'),
        )?.objectId ?? ''

      setStatus({
        kind: 'done',
        electionId: '0x' + electionId.toString(16),
        electionObject,
        digest: result.digest,
      })
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-6 md:py-10 space-y-10 md:space-y-12">
      <div>
        <p className="phase-marker mb-4">
          <span className="text-accent">█</span>
          <span>admin</span>
        </p>
        <h1 className="text-2xl md:text-h3 text-text-primary mb-3">Create a new election</h1>
        <p className="text-text-secondary max-w-2xl">
          Whoever signs this transaction becomes the admin. The election goes
          live in <strong>Registration</strong> phase — call{' '}
          <code className="hash">finalize_registration</code> from the backend
          after voters have registered.
        </p>
      </div>

      <WalletGate>
        {() => (
          <div className="card space-y-6">
            <Field label="Title">
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Candidates (comma-separated, ≥2)">
              <input
                className="input font-mono"
                value={candidatesText}
                onChange={(e) => setCandidatesText(e.target.value)}
                placeholder="No, Yes"
              />
            </Field>
            <Field label="Duration (hours)">
              <input
                type="number"
                min={1}
                max={720}
                className="input max-w-xs"
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
              />
            </Field>

            <button
              className="btn-primary"
              disabled={status.kind === 'executing'}
              onClick={onCreate}
            >
              {status.kind === 'executing'
                ? 'Creating on-chain…'
                : 'Create election →'}
            </button>

            {status.kind === 'done' ? (
              <div className="border-t border-bg-raised pt-4 space-y-3">
                <Stat label="election_id (u64)" value={status.electionId} />
                <Stat label="shared object" value={status.electionObject} />
                <Stat label="tx digest" value={status.digest} />
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link
                    to={`/elections/${status.electionObject}/register`}
                    className="btn-secondary"
                  >
                    Open registration
                  </Link>
                  <Link
                    to={`/elections/${status.electionObject}/results`}
                    className="btn-secondary"
                  >
                    View tally
                  </Link>
                </div>
              </div>
            ) : null}

            {status.kind === 'error' ? (
              <p className="text-sm text-danger font-mono">{status.message}</p>
            ) : null}
          </div>
        )}
      </WalletGate>

      {account && myElections !== null ? (
        <section className="space-y-5">
          <h2 className="phase-marker">
            <span className="text-accent">█</span>
            <span>your elections ({myElections.length})</span>
          </h2>
          {myElections.length === 0 ? (
            <div className="card text-text-muted">
              No elections created from this wallet yet.
            </div>
          ) : (
            <div className="card divide-y divide-bg-raised !p-0">
              {myElections.map((e) => {
                const state = electionStates[e.electionObject]
                const phase = state?.phase
                const phaseLabel =
                  phase === 0 ? 'registration' : phase === 1 ? 'voting' : phase === 2 ? 'closed' : '…'
                const ended = Date.now() >= e.endTimeMs
                const canFinalize = registrationOpen.has(e.electionObject)
                const busy = finalizeBusy === e.electionObject
                return (
                  <div
                    key={e.electionObject}
                    className="flex flex-wrap items-center gap-4 p-5"
                  >
                    <div className="flex-1 min-w-[240px] space-y-1">
                      <div className="font-display text-lg text-text-primary">
                        {e.title}
                      </div>
                      <div className="text-xs font-mono text-text-muted">
                        {e.candidates.join(' · ')} — {phaseLabel}
                        {phase === 1 && ended ? ' (ended)' : null}
                      </div>
                      <div className="hash !text-xs">
                        {e.electionObject.slice(0, 12)}…{e.electionObject.slice(-6)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/elections/${e.electionObject}/register`}
                        className="btn-secondary !py-2 !px-4 !text-sm"
                      >
                        Register
                      </Link>
                      {canFinalize ? (
                        <button
                          onClick={() => onFinalize(e.electionObject)}
                          disabled={busy}
                          className="btn-secondary !py-2 !px-4 !text-sm"
                        >
                          {busy ? 'Finalizing…' : 'Finalize →'}
                        </button>
                      ) : null}
                      <Link
                        to={`/elections/${e.electionObject}/vote`}
                        className="btn-secondary !py-2 !px-4 !text-sm"
                      >
                        Vote
                      </Link>
                      <Link
                        to={`/elections/${e.electionObject}/results`}
                        className="btn-primary !py-2 !px-4 !text-sm"
                      >
                        Tally →
                      </Link>
                    </div>
                  </div>
                )
              })}
              {finalizeError ? (
                <div className="p-5 text-sm text-danger font-mono">
                  {finalizeError}
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs text-text-muted font-mono uppercase">{label}</span>
      {children}
    </label>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-text-muted font-mono uppercase">{label}</div>
      <div className="hash break-all">{value}</div>
    </div>
  )
}

function randomElectionId(): bigint {
  const arr = new Uint8Array(8)
  crypto.getRandomValues(arr)
  let n = 0n
  for (const b of arr) n = (n << 8n) | BigInt(b)
  if (n === 0n) n = 1n
  return n
}
