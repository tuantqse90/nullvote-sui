import type { ReactNode } from 'react'
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit'

interface Props {
  children: (account: { address: string }) => ReactNode
  fallbackTitle?: string
  fallbackHint?: string
}

export default function WalletGate({ children, fallbackTitle, fallbackHint }: Props) {
  const account = useCurrentAccount()

  if (!account) {
    return (
      <div className="card max-w-xl">
        <p className="phase-marker mb-4">
          <span className="text-accent">█</span>
          <span>wallet required</span>
        </p>
        <h2 className="text-h3 text-text-primary mb-3">
          {fallbackTitle ?? 'Connect a Sui wallet to continue'}
        </h2>
        <p className="text-text-secondary mb-6">
          {fallbackHint ??
            'Your secret key is derived locally from the signature — it never leaves your device.'}
        </p>
        <ConnectButton />
      </div>
    )
  }

  return <>{children({ address: account.address })}</>
}
