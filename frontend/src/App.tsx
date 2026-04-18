import { Link, Route, Routes } from 'react-router-dom'
import { ConnectButton } from '@mysten/dapp-kit'

import Home from './pages/Home'
import Register from './pages/Register'
import Vote from './pages/Vote'
import Results from './pages/Results'
import Admin from './pages/Admin'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 md:px-14 py-6 border-b border-bg-elevated">
        <Link to="/" className="font-display text-2xl font-medium text-text-primary tracking-tight">
          NULL<span className="text-accent">*</span>VOTE
        </Link>
        <nav className="flex items-center gap-6">
          <Link to="/admin" className="text-sm text-text-muted hover:text-text-primary transition">
            Admin
          </Link>
          <ConnectButton />
        </nav>
      </header>

      <main className="flex-1 px-6 md:px-14 py-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/elections/:id/register" element={<Register />} />
          <Route path="/elections/:id/vote" element={<Vote />} />
          <Route path="/elections/:id/results" element={<Results />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>

      <footer className="px-6 md:px-14 py-6 border-t border-bg-elevated text-xs text-text-muted font-mono">
        <span className="text-accent">█</span> built by NullShift · hackathon 2026
      </footer>
    </div>
  )
}
