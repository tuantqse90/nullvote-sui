import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="space-y-12 md:space-y-20 max-w-6xl mx-auto py-6 md:py-10">
      {/* Hero */}
      <section className="space-y-1 md:space-y-2 overflow-hidden">
        <div className="hero-repeat hero-repeat-1">
          NULL<span className="text-accent">*</span>VOTE
        </div>
        <div className="hero-repeat hero-repeat-2" aria-hidden>
          NULL<span className="text-accent">*</span>VOTE
        </div>
        <div className="hero-repeat hero-repeat-3" aria-hidden>
          NULL<span className="text-accent">*</span>VOTE
        </div>
      </section>

      <section className="max-w-2xl space-y-6 md:space-y-8">
        <p className="text-lg md:text-2xl text-text-secondary leading-snug">
          Anonymous DAO governance voting on SUI. Zero-knowledge proofs verify
          eligibility without revealing identity. Votes are public.{' '}
          <span className="text-accent">Voters are anonymous.</span>
        </p>

        <div className="flex flex-wrap gap-4">
          <Link to="/admin" className="btn-primary">
            Launch an election →
          </Link>
          <a
            href="https://github.com/tuantqse90/nullvote-sui"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
          >
            Read the docs
          </a>
        </div>
      </section>

      {/* Quick-jump cards for the demo flow */}
      <section className="space-y-6">
        <h2 className="phase-marker">
          <span className="text-accent">█</span>
          <span>demo flow</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              num: '01',
              title: 'Register',
              body: 'Sign a wallet message → commitment published off-chain.',
              to: '/admin',
            },
            {
              num: '02',
              title: 'Vote',
              body: 'Generate a ZK proof locally → cast on-chain. ~3 s on a laptop.',
              to: '/admin',
            },
            {
              num: '03',
              title: 'Tally',
              body: 'Public tally, unlinkable nullifiers, double-vote blocked in Move.',
              to: '/admin',
            },
          ].map((step) => (
            <Link
              key={step.num}
              to={step.to}
              className="card hover:bg-bg-raised transition-colors duration-150 group"
            >
              <div className="font-mono text-text-muted text-sm mb-3">
                {step.num}
              </div>
              <div className="font-display text-2xl text-text-primary mb-3 group-hover:text-accent transition-colors">
                {step.title}
              </div>
              <p className="text-text-secondary text-sm leading-relaxed">
                {step.body}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
