import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSuiClient } from '@mysten/dapp-kit'

import LiveTally from '../components/LiveTally'
import { fetchElection, type ElectionView } from '../lib/sui'
import { bigintToHex32 } from '../lib/crypto'

export default function Results() {
  const { id = '' } = useParams<{ id: string }>()
  const suiClient = useSuiClient()
  const [election, setElection] = useState<ElectionView | null>(null)

  useEffect(() => {
    const load = async () => {
      const view = await fetchElection(suiClient, id)
      setElection(view)
    }
    load()
    const interval = setInterval(load, 3000) // Day-5 polling fallback; Day 6 wires subscribeEvent.
    return () => clearInterval(interval)
  }, [suiClient, id])

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-10">
      <div className="flex items-center gap-4">
        <span className="live-badge">
          <span className="live-dot">█</span>
          LIVE
        </span>
        <h1 className="text-h3 text-text-primary">{election?.title ?? 'Loading…'}</h1>
      </div>

      <p className="text-text-secondary">
        Election{' '}
        <code className="hash">
          {bigintToHex32(election?.electionId ?? 0n).slice(0, 18)}…
        </code>
      </p>

      {election ? (
        <div className="card space-y-6">
          <LiveTally candidates={election.candidates} tally={election.tally} />
          <div className="text-xs text-text-muted font-mono border-t border-bg-raised pt-4">
            nullifiers committed: auto-counted on-chain via the Table
          </div>
        </div>
      ) : (
        <div className="card">
          <p className="text-text-secondary">Loading live tally…</p>
        </div>
      )}
    </div>
  )
}
