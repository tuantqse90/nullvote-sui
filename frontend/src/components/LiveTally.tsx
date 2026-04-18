import FlipCounter from './FlipCounter'

interface Props {
  candidates: string[]
  tally: bigint[]
}

export default function LiveTally({ candidates, tally }: Props) {
  const counts = candidates.map((_, i) => Number(tally[i] ?? 0))
  const total = counts.reduce((a, b) => a + b, 0) || 1

  return (
    <div className="space-y-4">
      {candidates.map((name, i) => {
        const count = counts[i]
        const pct = Math.round((count / total) * 100)
        const barCells = 20
        const filled = Math.round((pct / 100) * barCells)
        const bar = '█'.repeat(filled) + '░'.repeat(barCells - filled)
        return (
          <div key={name} className="flex items-center gap-4 font-mono text-sm">
            <span className="w-24 text-text-secondary uppercase tracking-wider">
              {name}
            </span>
            <span className="text-accent">{bar}</span>
            <span className="text-text-secondary tabular-nums ml-auto flex items-baseline gap-2">
              <FlipCounter value={count} className="text-xl" />
              <span className="text-text-muted">·</span>
              <span>{pct}%</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
