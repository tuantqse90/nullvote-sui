// Sui transaction builders — one per Move entry we call from the UI.

import { Transaction } from '@mysten/sui/transactions'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'

import { PACKAGE_ID, SUI_NETWORK } from './env'

export const SUI_CLOCK_OBJECT_ID = '0x6'

export function makeSuiClient(): SuiClient {
  return new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) })
}

/** Structural type — `@mysten/dapp-kit`'s internal SuiClient and our top-level
 *  SuiClient are different classes (different npm subtrees) but share this
 *  contract. Using a structural type avoids brittle type-identity checks. */
export interface ReadableSuiClient {
  getObject(args: {
    id: string
    options?: { showContent?: boolean; [k: string]: unknown }
  }): Promise<any>
}

/** `nullvote::election::create_election(election_id, title, candidates, end_time_ms)` */
export function buildCreateElectionTx(args: {
  electionId: bigint
  title: string
  candidates: string[]
  endTimeMs: bigint
}): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${PACKAGE_ID}::election::create_election`,
    arguments: [
      tx.pure.u64(args.electionId),
      tx.pure.string(args.title),
      tx.pure.vector('string', args.candidates),
      tx.pure.u64(args.endTimeMs),
    ],
  })
  return tx
}

/** `nullvote::election::finalize_registration(election, merkle_root)` */
export function buildFinalizeRegistrationTx(args: {
  electionObject: string
  merkleRoot: Uint8Array
}): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${PACKAGE_ID}::election::finalize_registration`,
    arguments: [
      tx.object(args.electionObject),
      tx.pure.vector('u8', Array.from(args.merkleRoot)),
    ],
  })
  return tx
}

/** `nullvote::election::cast_vote(election, proof, public_inputs, clock)` */
export function buildCastVoteTx(args: {
  electionObject: string
  proofBytes: Uint8Array
  publicInputsBytes: Uint8Array
}): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${PACKAGE_ID}::election::cast_vote`,
    arguments: [
      tx.object(args.electionObject),
      tx.pure.vector('u8', Array.from(args.proofBytes)),
      tx.pure.vector('u8', Array.from(args.publicInputsBytes)),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  })
  return tx
}

/** Parse the `election::Election` shared object into a strongly-typed view. */
export interface ElectionView {
  id: string
  admin: string
  electionId: bigint
  title: string
  candidates: string[]
  merkleRoot: Uint8Array
  tally: bigint[]
  endTimeMs: bigint
  phase: number
}

export async function fetchElection(
  client: ReadableSuiClient,
  objectId: string,
): Promise<ElectionView | null> {
  const resp = await client.getObject({
    id: objectId,
    options: { showContent: true },
  })
  const fields = (resp.data?.content as any)?.fields
  if (!fields) return null
  return {
    id: objectId,
    admin: fields.admin,
    electionId: BigInt(fields.election_id),
    title: fields.title,
    candidates: fields.candidates,
    merkleRoot: Uint8Array.from(fields.merkle_root ?? []),
    tally: (fields.tally ?? []).map((x: string) => BigInt(x)),
    endTimeMs: BigInt(fields.end_time_ms),
    phase: Number(fields.phase),
  }
}
