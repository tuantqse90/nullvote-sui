import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSignPersonalMessage } from '@mysten/dapp-kit'

import WalletGate from '../components/WalletGate'
import {
  bigintToHex32,
  computeCommitment,
  derivePk,
  randomR,
  signPayloadForElection,
  signatureToSk,
} from '../lib/crypto'
import { registerCommitment } from '../lib/backend'

interface StoredIdentity {
  electionId: string
  address: string
  sk: string
  r: string
  commitment: string
  createdAt: string
}

type Status =
  | { kind: 'idle' }
  | { kind: 'signing' }
  | { kind: 'posting' }
  | { kind: 'done'; commitment: string }
  | { kind: 'error'; message: string }

const LOCALSTORAGE_KEY = (electionId: string) => `nullvote:identity:${electionId}`

export default function Register() {
  const { id = '' } = useParams<{ id: string }>()
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [importError, setImportError] = useState<string | null>(null)
  const [importText, setImportText] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [existingTick, setExistingTick] = useState(0)

  const existing = useMemo<StoredIdentity | null>(() => {
    void existingTick
    const raw = localStorage.getItem(LOCALSTORAGE_KEY(id))
    if (!raw) return null
    try {
      return JSON.parse(raw) as StoredIdentity
    } catch {
      return null
    }
  }, [id, existingTick])

  async function onRegister(address: string) {
    setStatus({ kind: 'signing' })
    try {
      const payload = signPayloadForElection(id)
      const encoded = new TextEncoder().encode(payload)

      const signature = await signPersonalMessage({ message: encoded })
      // `signature.signature` is the base64 signature from the wallet. We fold
      // the raw signature bytes into a Poseidon-sized scalar.
      const sigBytes = base64ToBytes(signature.signature)
      const sk = signatureToSk(sigBytes)
      const r = randomR()
      const pk = derivePk(sk)
      const commitment = computeCommitment(pk, r)

      const stored: StoredIdentity = {
        electionId: id,
        address,
        sk: bigintToHex32(sk),
        r: bigintToHex32(r),
        commitment: bigintToHex32(commitment),
        createdAt: new Date().toISOString(),
      }
      localStorage.setItem(LOCALSTORAGE_KEY(id), JSON.stringify(stored))
      setExistingTick((n) => n + 1)

      setStatus({ kind: 'posting' })
      const result = await registerCommitment(
        id,
        address,
        bigintToHex32(commitment),
      )
      setStatus({ kind: 'done', commitment: result.commitment })
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 md:py-10 space-y-8 md:space-y-10">
      <div>
        <p className="phase-marker mb-4">
          <span className="text-accent">█</span>
          <span>phase 01 — registration</span>
        </p>
        <h1 className="text-2xl md:text-h3 text-text-primary mb-3">Register to vote</h1>
        <p className="text-text-secondary">
          Election{' '}
          <code className="hash">{id.slice(0, 10)}…{id.slice(-6)}</code>. The
          signature derives your secret key locally; the server only receives
          a Poseidon commitment.
        </p>
      </div>

      <WalletGate>
        {({ address }) => (
          <div className="card space-y-6">
            <div className="space-y-1">
              <div className="text-xs text-text-muted font-mono uppercase">
                Wallet
              </div>
              <div className="hash">{shortAddr(address)}</div>
            </div>

            <button
              className="btn-primary"
              disabled={status.kind === 'signing' || status.kind === 'posting'}
              onClick={() => onRegister(address)}
            >
              {status.kind === 'signing'
                ? 'Awaiting signature…'
                : status.kind === 'posting'
                  ? 'Submitting commitment…'
                  : status.kind === 'done'
                    ? 'Registered ✓'
                    : 'Sign & register →'}
            </button>

            {status.kind === 'done' && existing ? (
              <div className="space-y-3 border-t border-bg-raised pt-4">
                <div className="text-xs text-text-muted font-mono uppercase">
                  Commitment
                </div>
                <div className="hash break-all">{status.commitment}</div>
                <button
                  type="button"
                  className="btn-secondary !py-2 !px-4 !text-sm"
                  onClick={() => downloadIdentity(existing)}
                >
                  Export identity backup
                </button>
                <p className="text-xs text-text-muted">
                  Downloads a JSON with your secret, salt, and commitment. Store
                  it somewhere safe — the secret never leaves your device, so
                  if you clear this browser's data without a backup you can't
                  vote in this election from a new device.
                </p>
              </div>
            ) : null}

            {status.kind === 'error' ? (
              <div className="text-sm text-danger font-mono">{status.message}</div>
            ) : null}
          </div>
        )}
      </WalletGate>

      {/* ── Import section ─────────────────────────────────────── */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-sm font-mono uppercase text-text-muted">
            Import an existing identity
          </h3>
          <button
            type="button"
            className="text-xs text-text-muted font-mono hover:text-text-primary transition"
            onClick={() => setImportOpen((v) => !v)}
          >
            {importOpen ? 'close' : 'paste JSON →'}
          </button>
        </div>
        {importOpen ? (
          <>
            <textarea
              className="input font-mono text-xs h-28 resize-none"
              placeholder='{"electionId":"0x…","sk":"0x…","r":"0x…","commitment":"0x…","address":"0x…"}'
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value)
                setImportError(null)
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-secondary !py-2 !px-4 !text-sm"
                onClick={() => {
                  try {
                    const parsed = parseAndValidate(importText, id)
                    localStorage.setItem(
                      LOCALSTORAGE_KEY(id),
                      JSON.stringify(parsed),
                    )
                    setExistingTick((n) => n + 1)
                    setImportText('')
                    setImportOpen(false)
                  } catch (err) {
                    setImportError(
                      err instanceof Error ? err.message : String(err),
                    )
                  }
                }}
              >
                Restore →
              </button>
              {importError ? (
                <span className="text-xs text-danger font-mono">
                  {importError}
                </span>
              ) : null}
            </div>
          </>
        ) : existing ? (
          <p className="text-xs text-text-muted">
            Already have an identity stored in this browser
            (commitment <span className="hash">{existing.commitment.slice(0, 14)}…</span>).
          </p>
        ) : null}
      </section>
    </div>
  )
}

function shortAddr(addr: string): string {
  return addr.slice(0, 10) + '…' + addr.slice(-6)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function downloadIdentity(identity: StoredIdentity) {
  const blob = new Blob([JSON.stringify(identity, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nullvote-identity-${identity.electionId.slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function parseAndValidate(json: string, expectedElection: string): StoredIdentity {
  const parsed = JSON.parse(json)
  for (const field of ['electionId', 'address', 'sk', 'r', 'commitment']) {
    if (typeof parsed[field] !== 'string') {
      throw new Error(`missing field: ${field}`)
    }
  }
  if (parsed.electionId !== expectedElection) {
    throw new Error(
      `wrong election: backup is for ${parsed.electionId.slice(0, 10)}… but current page is ${expectedElection.slice(0, 10)}…`,
    )
  }
  return parsed as StoredIdentity
}
