// Thin typed client for the FastAPI backend. One function per endpoint.

import { BACKEND_URL } from './env'

export interface RegisterResult {
  ok: boolean
  election_id: string
  commitment: string
}

export interface MerkleProofResponse {
  election_id: string
  commitment: string
  root: string
  path_elements: string[]
  path_indices: number[]
}

export interface TreeResponse {
  election_id: string
  depth: number
  root: string
  leaf_count: number
  leaves: string[]
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status} ${res.statusText} ${body.slice(0, 300)}`)
  }
  return (await res.json()) as T
}

export function registerCommitment(
  electionId: string,
  walletAddr: string,
  commitment: string,
): Promise<RegisterResult> {
  return fetchJson(`${BACKEND_URL}/api/elections/${electionId}/register`, {
    method: 'POST',
    body: JSON.stringify({ wallet_addr: walletAddr, commitment }),
  })
}

export function fetchMerkleProof(
  electionId: string,
  commitment: string,
): Promise<MerkleProofResponse> {
  const qs = new URLSearchParams({ commitment })
  return fetchJson(
    `${BACKEND_URL}/api/elections/${electionId}/merkle-proof?${qs}`,
  )
}

export function fetchMerkleTree(electionId: string): Promise<TreeResponse> {
  return fetchJson(`${BACKEND_URL}/api/elections/${electionId}/merkle-tree`)
}

export interface CloseRegistrationResponse {
  election_id: string
  election_object: string
  package_id: string
  merkle_root: string
  voter_count: number
  cli_command: string
  executed: boolean
  tx_digest: string | null
}

export function closeRegistration(
  electionId: string,
  electionObject: string,
): Promise<CloseRegistrationResponse> {
  const qs = new URLSearchParams({ election_object: electionObject })
  return fetchJson(
    `${BACKEND_URL}/api/elections/${electionId}/close-registration?${qs}`,
    { method: 'POST', body: '{}' },
  )
}
