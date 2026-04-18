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
        return (
          <div
            key={name}
            className="grid grid-cols-[minmax(60px,auto)_1fr_auto] items-center gap-3 font-mono text-sm"
          >
            <span className="text-text-secondary uppercase tracking-wider">
              {name}
            </span>
            <div
              aria-hidden
              className="relative h-4 rounded-sm bg-bg-raised overflow-hidden"
            >
              <div
                className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-text-secondary tabular-nums flex items-baseline gap-2 whitespace-nowrap">
              <FlipCounter value={count} className="text-lg md:text-xl" />
              <span className="text-text-muted">·</span>
              <span>{pct}%</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
