// Small helper so page code doesn't reach for `import.meta.env.VITE_*` directly.

export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

export const PACKAGE_ID: string =
  import.meta.env.VITE_PACKAGE_ID ??
  '0x669ec8fee063206af29be9407865b5e2698f0f8f604b568c97c4e296acdb63be'

export const SUI_NETWORK: 'testnet' | 'mainnet' =
  (import.meta.env.VITE_SUI_NETWORK as 'testnet' | 'mainnet') ?? 'testnet'

export const DEPTH = 8 // must match Vote(8) in vote.circom
