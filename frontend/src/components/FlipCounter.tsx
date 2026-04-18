import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  /** Extra classes on the outer span. */
  className?: string
}

/** Number that slides vertically on change. Mono font, tabular digits so width
 *  stays stable. Used for live tally cells. */
export default function FlipCounter({ value, className }: Props) {
  const [display, setDisplay] = useState(value)
  const [flipping, setFlipping] = useState(false)
  const prev = useRef(value)

  useEffect(() => {
    if (value === prev.current) return
    setFlipping(true)
    const h = setTimeout(() => {
      setDisplay(value)
      prev.current = value
      setTimeout(() => setFlipping(false), 320)
    }, 40)
    return () => clearTimeout(h)
  }, [value])

  return (
    <span
      className={`inline-block font-mono tabular-nums transition-[color,transform] duration-300 ease-out ${
        flipping ? 'text-accent -translate-y-1 scale-110' : 'text-text-primary'
      } ${className ?? ''}`}
    >
      {display}
    </span>
  )
}
