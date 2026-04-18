// Realtime tally via polling `queryEvents`.
//
// SuiClient.subscribeEvent exists but relies on a WebSocket transport that's
// flaky on public fullnodes. Per PLAN.md Day 6 fallback, we poll every 2 s —
// well under the "within 2 s" visual-update target, always works, and
// trivially recovers from transient failures.

import type { ReadableSuiClient } from './sui'
import { PACKAGE_ID } from './env'

export interface VoteCastEvent {
  electionObject: string
  nullifier: string
  voteIndex: number
  timestampMs: number
}

interface EventsClient {
  queryEvents(input: any): Promise<{ data: any[]; nextCursor?: any }>
}

/** Subscribe to `VoteCast` events for a specific election. Returns an
 *  unsubscribe function. Polling cadence defaults to 2000 ms. */
export function subscribeToVoteEvents(
  client: ReadableSuiClient & EventsClient,
  electionObjectId: string,
  onVote: (event: VoteCastEvent) => void,
  intervalMs = 2000,
): () => void {
  let cursor: any = null
  let cancelled = false

  const tick = async () => {
    if (cancelled) return
    try {
      const res = await client.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::events::VoteCast` },
        cursor,
        order: 'ascending',
        limit: 50,
      })
      for (const e of res.data ?? []) {
        const parsed = e.parsedJson as any
        if (!parsed) continue
        const obj = parsed.election_id
        if (obj !== electionObjectId) continue
        onVote({
          electionObject: obj,
          nullifier: b64OrHex(parsed.nullifier),
          voteIndex: Number(parsed.vote_index),
          timestampMs: Number(parsed.timestamp_ms),
        })
      }
      if (res.nextCursor) cursor = res.nextCursor
    } catch {
      // Network blips: silent, next tick retries.
    }
  }

  // Fire immediately so initial load doesn't wait the first interval.
  tick()
  const handle = setInterval(tick, intervalMs)
  return () => {
    cancelled = true
    clearInterval(handle)
  }
}

/** Events sometimes arrive as base64 (default JSON codec) — normalize to hex. */
function b64OrHex(value: unknown): string {
  if (typeof value !== 'string') return ''
  if (value.startsWith('0x') || /^[0-9a-fA-F]+$/.test(value)) return value.startsWith('0x') ? value : '0x' + value
  try {
    const bin = atob(value)
    let hex = '0x'
    for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, '0')
    return hex
  } catch {
    return value
  }
}

export interface ElectionCreatedEvent {
  electionObject: string
  admin: string
  circuitElectionId: string
  title: string
  candidates: string[]
  endTimeMs: number
}

/** One-shot: fetch all ElectionCreated events ever emitted by our package.
 *  Used by Admin.tsx to populate the "your elections" table. */
export async function listElectionCreatedEvents(
  client: EventsClient,
  filterAdmin?: string,
): Promise<ElectionCreatedEvent[]> {
  const out: ElectionCreatedEvent[] = []
  let cursor: any = null
  for (;;) {
    const res = await client.queryEvents({
      query: { MoveEventType: `${PACKAGE_ID}::events::ElectionCreated` },
      cursor,
      order: 'descending',
      limit: 50,
    })
    for (const e of res.data ?? []) {
      const p = e.parsedJson as any
      if (!p) continue
      if (filterAdmin && p.admin !== filterAdmin) continue
      out.push({
        electionObject: p.election_id,
        admin: p.admin,
        circuitElectionId: p.circuit_election_id,
        title: p.title,
        candidates: p.candidates,
        endTimeMs: Number(p.end_time_ms),
      })
    }
    if (!res.nextCursor || (res.data?.length ?? 0) < 50) break
    cursor = res.nextCursor
  }
  return out
}
