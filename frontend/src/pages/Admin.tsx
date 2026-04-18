import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit'

import WalletGate from '../components/WalletGate'
import { buildCreateElectionTx } from '../lib/sui'
import {
  listElectionCreatedEvents,
  type ElectionCreatedEvent,
} from '../lib/subscribe'

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
  }, [suiClient, account, status.kind])

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
    <div className="max-w-4xl mx-auto py-10 space-y-12">
      <div>
        <p className="phase-marker mb-4">
          <span className="text-accent">█</span>
          <span>admin</span>
        </p>
        <h1 className="text-h3 text-text-primary mb-3">Create a new election</h1>
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
                const ended = Date.now() >= e.endTimeMs
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
                        {e.candidates.join(' · ')} — {ended ? 'ended' : 'active'}
                      </div>
                      <div className="hash !text-xs">
                        {e.electionObject.slice(0, 12)}…{e.electionObject.slice(-6)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to={`/elections/${e.electionObject}/register`}
                        className="btn-secondary !py-2 !px-4 !text-sm"
                      >
                        Register
                      </Link>
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
