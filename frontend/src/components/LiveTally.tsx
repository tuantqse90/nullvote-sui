interface Props {
  candidates: string[]
  tally: bigint[]
}

// Static, animation-free version for Day 5. Day 6 will add the counter flip
// + realtime event subscription.
export default function LiveTally({ candidates, tally }: Props) {
  const total = tally.reduce((a, b) => a + Number(b), 0) || 1
  return (
    <div className="space-y-3">
      {candidates.map((name, i) => {
        const count = Number(tally[i] ?? 0)
        const pct = Math.round((count / total) * 100)
        const barCells = 20
        const filled = Math.round((pct / 100) * barCells)
        const bar = '█'.repeat(filled) + '░'.repeat(barCells - filled)
        return (
          <div key={name} className="flex items-center gap-4 font-mono text-sm">
            <span className="w-16 text-text-secondary uppercase">{name}</span>
            <span className="text-accent">{bar}</span>
            <span className="text-text-secondary tabular-nums">
              {count} · {pct}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
