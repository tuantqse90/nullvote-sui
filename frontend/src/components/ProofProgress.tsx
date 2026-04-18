interface Props {
  state: 'idle' | 'generating' | 'done' | 'error'
  elapsedMs: number
  errorMessage?: string
}

// Block-character ASCII progress bar per DESIGN_SYSTEM.md §6.4.
export default function ProofProgress({ state, elapsedMs, errorMessage }: Props) {
  const seconds = (elapsedMs / 1000).toFixed(1)
  const totalBars = 10
  const targetMs = 4500 // expected typical proof time
  const pct = state === 'done' ? 1 : Math.min(elapsedMs / targetMs, 0.95)
  const filled = Math.max(1, Math.floor(pct * totalBars))
  const bar = '█'.repeat(filled) + '░'.repeat(totalBars - filled)

  const color =
    state === 'error'
      ? 'text-danger'
      : state === 'done'
        ? 'text-accent'
        : 'text-warning'

  const label =
    state === 'idle'
      ? 'READY'
      : state === 'generating'
        ? 'GENERATING PROOF'
        : state === 'done'
          ? 'PROOF COMPLETE'
          : 'PROOF FAILED'

  return (
    <div className="font-mono text-sm">
      <div className={color}>
        [{bar}] {label} · {seconds}s
      </div>
      {state === 'error' && errorMessage ? (
        <div className="mt-2 text-xs text-danger">{errorMessage}</div>
      ) : null}
    </div>
  )
}
