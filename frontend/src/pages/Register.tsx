import { useState } from 'react'
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

      localStorage.setItem(
        LOCALSTORAGE_KEY(id),
        JSON.stringify({
          sk: bigintToHex32(sk),
          r: bigintToHex32(r),
          commitment: bigintToHex32(commitment),
          address,
        }),
      )

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
    <div className="max-w-2xl mx-auto py-10 space-y-10">
      <div>
        <p className="phase-marker mb-4">
          <span className="text-accent">█</span>
          <span>phase 01 — registration</span>
        </p>
        <h1 className="text-h3 text-text-primary mb-3">Register to vote</h1>
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

            {status.kind === 'done' ? (
              <div className="space-y-2 border-t border-bg-raised pt-4">
                <div className="text-xs text-text-muted font-mono uppercase">
                  Commitment
                </div>
                <div className="hash break-all">{status.commitment}</div>
                <p className="text-xs text-text-muted">
                  Secret + salt are stored in this browser's localStorage under
                  key <code className="hash">nullvote:identity:{id.slice(0, 8)}…</code>
                  — back it up if you plan to vote from another device.
                </p>
              </div>
            ) : null}

            {status.kind === 'error' ? (
              <div className="text-sm text-danger font-mono">{status.message}</div>
            ) : null}
          </div>
        )}
      </WalletGate>
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
