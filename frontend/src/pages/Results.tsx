import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSuiClient } from '@mysten/dapp-kit'

import LiveTally from '../components/LiveTally'
import { fetchElection, type ElectionView } from '../lib/sui'
import { bigintToHex32 } from '../lib/crypto'
import { subscribeToVoteEvents, type VoteCastEvent } from '../lib/subscribe'

interface RecentVote {
  nullifier: string
  voteIndex: number
  timestampMs: number
}

export default function Results() {
  const { id = '' } = useParams<{ id: string }>()
  const suiClient = useSuiClient()
  const [election, setElection] = useState<ElectionView | null>(null)
  const [recent, setRecent] = useState<RecentVote[]>([])
  const firstLoad = useRef(true)

  // Load election state + refresh it every time a new vote lands.
  useEffect(() => {
    let alive = true
    const load = async () => {
      const view = await fetchElection(suiClient as any, id)
      if (alive) setElection(view)
    }
    load()

    const unsubscribe = subscribeToVoteEvents(
      suiClient as any,
      id,
      (ev: VoteCastEvent) => {
        // Skip events we've already observed (happens on initial backfill).
        setRecent((prev) => {
          if (prev.some((r) => r.nullifier === ev.nullifier)) return prev
          return [
            { nullifier: ev.nullifier, voteIndex: ev.voteIndex, timestampMs: ev.timestampMs },
            ...prev,
          ].slice(0, 10)
        })
        // Any new vote → refresh tally.
        if (!firstLoad.current) load()
      },
    )
    firstLoad.current = false

    return () => {
      alive = false
      unsubscribe()
    }
  }, [suiClient, id])

  const now = Date.now()
  const ended = election ? now >= Number(election.endTimeMs) : false

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-10">
      <div className="flex flex-wrap items-center gap-4">
        <span className="live-badge">
          <span className="live-dot">█</span>
          {ended ? 'CLOSED' : 'LIVE'}
        </span>
        <h1 className="text-h3 text-text-primary">
          {election?.title ?? 'Loading…'}
        </h1>
      </div>

      <div className="flex flex-wrap gap-6 text-sm font-mono text-text-muted">
        <div>
          <span className="text-text-muted uppercase">election</span>{' '}
          <span className="hash">
            {bigintToHex32(election?.electionId ?? 0n).slice(0, 18)}…
          </span>
        </div>
        {election ? (
          <div>
            <span className="text-text-muted uppercase">ends</span>{' '}
            <span className="text-text-secondary">
              {new Date(Number(election.endTimeMs)).toLocaleString()}
            </span>
          </div>
        ) : null}
      </div>

      {election ? (
        <div className="card space-y-8">
          <LiveTally candidates={election.candidates} tally={election.tally} />
          <div className="text-xs text-text-muted font-mono border-t border-bg-raised pt-4 flex justify-between">
            <span>
              nullifiers committed: {Number(election.tally.reduce((a, b) => a + b, 0n))}
            </span>
            <span>poll interval: 2 s</span>
          </div>
        </div>
      ) : (
        <div className="card">
          <p className="text-text-secondary">Loading live tally…</p>
        </div>
      )}

      {recent.length > 0 ? (
        <section className="space-y-4">
          <h2 className="phase-marker">
            <span className="text-accent">█</span>
            <span>recent votes</span>
          </h2>
          <ul className="space-y-2 font-mono text-sm">
            {recent.map((v) => (
              <li
                key={v.nullifier}
                className="flex items-center gap-4 text-text-secondary"
              >
                <span className="hash">{shortNullifier(v.nullifier)}</span>
                <span className="text-text-muted">→</span>
                <span className="uppercase text-text-primary">
                  {election?.candidates[v.voteIndex] ?? `option ${v.voteIndex}`}
                </span>
                <span className="text-text-muted ml-auto">
                  {timeAgo(v.timestampMs)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function shortNullifier(n: string): string {
  const s = n.startsWith('0x') ? n.slice(2) : n
  return `0x${s.slice(0, 8)}…████…${s.slice(-4)}`
}

function timeAgo(ms: number): string {
  const diff = Math.max(0, Date.now() - ms)
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}
