import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit'

import WalletGate from '../components/WalletGate'
import { buildCreateElectionTx } from '../lib/sui'

type Status =
  | { kind: 'idle' }
  | { kind: 'executing' }
  | { kind: 'done'; electionId: string; electionObject: string; digest: string }
  | { kind: 'error'; message: string }

export default function Admin() {
  const suiClient = useSuiClient()
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()

  const [title, setTitle] = useState('Treasury Proposal')
  const [candidatesText, setCandidatesText] = useState('No, Yes')
  const [durationHours, setDurationHours] = useState(24)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

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
      // Serialize to bypass the @mysten/sui version-skew between the top-level
      // and the one dapp-kit ships — `transaction: string` is always safe.
      const result = await signAndExecute({ transaction: await tx.toJSON() })

      // Look up the created Election shared object ID via tx effects.
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
    <div className="max-w-3xl mx-auto py-10 space-y-10">
      <div>
        <p className="phase-marker mb-4">
          <span className="text-accent">█</span>
          <span>admin</span>
        </p>
        <h1 className="text-h3 text-text-primary mb-3">Create a new election</h1>
        <p className="text-text-secondary">
          Whoever signs this transaction becomes the admin. The election goes
          live in <strong>Registration</strong> phase — call{' '}
          <code className="hash">finalize_registration</code> from the backend
          once enough voters have registered.
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
                className="input"
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
                <Stat label="election_id" value={status.electionId} />
                <Stat label="shared object" value={status.electionObject} />
                <Stat label="tx digest" value={status.digest} />
                <div className="flex gap-4 pt-2">
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

/** Random u64 election id, avoiding zero. */
function randomElectionId(): bigint {
  const arr = new Uint8Array(8)
  crypto.getRandomValues(arr)
  let n = 0n
  for (const b of arr) n = (n << 8n) | BigInt(b)
  if (n === 0n) n = 1n
  return n
}
