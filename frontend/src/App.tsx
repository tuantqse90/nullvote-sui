import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { ConnectButton } from '@mysten/dapp-kit'

// Home is small and on every page — load eagerly.
import Home from './pages/Home'

// The rest of the pages pull in @mysten/sui transaction builders and,
// transitively for /vote, lazy-import the prover Web Worker — split them so
// the initial landing bundle stays small.
const Admin = lazy(() => import('./pages/Admin'))
const Register = lazy(() => import('./pages/Register'))
const Vote = lazy(() => import('./pages/Vote'))
const Results = lazy(() => import('./pages/Results'))

function PageFallback() {
  return (
    <div className="max-w-2xl mx-auto py-10">
      <div className="card">
        <p className="text-text-secondary">Loading…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-14 py-5 md:py-6 border-b border-bg-elevated gap-3">
        <Link
          to="/"
          className="font-display text-xl md:text-2xl font-medium text-text-primary tracking-tight"
        >
          NULL<span className="text-accent">*</span>VOTE
        </Link>
        <nav className="flex items-center gap-4 md:gap-6">
          <Link
            to="/admin"
            className="text-sm text-text-muted hover:text-text-primary transition"
          >
            Admin
          </Link>
          <ConnectButton />
        </nav>
      </header>

      <main className="flex-1 px-4 md:px-14 py-6 md:py-10">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/elections/:id/register" element={<Register />} />
            <Route path="/elections/:id/vote" element={<Vote />} />
            <Route path="/elections/:id/results" element={<Results />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Suspense>
      </main>

      <footer className="px-4 md:px-14 py-5 md:py-6 border-t border-bg-elevated text-xs text-text-muted font-mono">
        <span className="text-accent">█</span> built by NullShift · hackathon 2026
      </footer>
    </div>
  )
}
