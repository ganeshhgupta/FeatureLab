'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Brain, RefreshCw, Target, Layers, ChevronRight } from 'lucide-react'

const agentSteps = [
  { icon: '🔍', label: 'OBSERVE', desc: 'Profile feature distributions' },
  { icon: '💡', label: 'HYPOTHESIZE', desc: 'Propose transformations' },
  { icon: '⚙️', label: 'EXECUTE', desc: 'Apply transformations' },
  { icon: '📊', label: 'EVALUATE', desc: 'Measure signal improvement' },
  { icon: '✅', label: 'DECIDE', desc: 'Keep or discard with evidence' },
]

export default function Home() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0d1117' }}>
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5" style={{ backgroundColor: 'rgba(13,17,23,0.92)', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span className="text-white font-semibold text-lg">FeatureLab</span>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              Autonomous ML Feature Engineering
            </div>
            <h1 className="text-6xl font-bold leading-tight mb-6">
              <span className="text-white">Transform Features</span>
              <br />
              <span className="text-cyan-400">Intelligently</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-lg">
              An AI agent that observes, hypothesizes, executes, and evaluates feature transformations for CTR prediction — with full reasoning transparency.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
              >
                Launch FeatureLab <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href="/dashboard?demo=true"
                className="flex items-center gap-2 px-6 py-3 rounded-lg border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-medium transition-all"
              >
                Try Demo Dataset
              </Link>
            </div>
          </motion.div>

          {/* Right — agent loop card */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
            <div className="rounded-xl border border-white/10 overflow-hidden" style={{ backgroundColor: '#161b22' }}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5" style={{ backgroundColor: 'rgba(13,17,23,0.5)' }}>
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                <span className="ml-3 text-sm text-slate-400 font-mono">agent_loop.py</span>
              </div>
              <div className="p-2">
                {agentSteps.map((step, i) => (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white/5 transition-colors cursor-default group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ backgroundColor: 'rgba(99,102,241,0.15)' }}>
                        {step.icon}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{step.label}</div>
                        <div className="text-xs text-slate-400">{step.desc}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What Makes This Agentic */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              What Makes This <span className="text-cyan-400">Agentic</span>
            </h2>
            <p className="text-slate-400 text-lg">
              Not just a pipeline — an intelligent agent with reasoning, iteration, and discovery capabilities.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {/* AI-Powered Reasoning */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
              className="p-8 rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 to-indigo-600/5">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-5">
                <Brain className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">AI-Powered Reasoning</h3>
              <p className="text-slate-400 leading-relaxed">Gemini-driven agent explains WHY each transformation helps, grounded in statistical analysis.</p>
            </motion.div>

            {/* Iterative Refinement */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="p-8 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-cyan-600/5">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-5">
                <RefreshCw className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Iterative Refinement</h3>
              <p className="text-slate-400 leading-relaxed">When transformations fail, the agent proposes alternatives rather than silently moving on.</p>
            </motion.div>

            {/* Rigorous Evaluation */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="p-8 rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/20 to-red-600/5">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center mb-5">
                <Target className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Rigorous Evaluation</h3>
              <p className="text-slate-400 leading-relaxed">Every feature tested with MI, IV, AUC, and LightGBM importance against strict thresholds.</p>
            </motion.div>

            {/* Cross-Feature Intelligence */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="p-8 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/20 to-purple-600/5">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-5">
                <Layers className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Cross-Feature Intelligence</h3>
              <p className="text-slate-400 leading-relaxed">Discovers meaningful interaction terms between top features for CTR prediction.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Demo Video */}
      <section className="py-24 px-6" style={{ backgroundColor: 'rgba(13,17,23,0.8)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">See It In Action</h2>
            <p className="text-slate-400 text-lg">Watch FeatureLab autonomously engineer features from a real Criteo CTR dataset.</p>
          </div>
          <div className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-indigo-500/10">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5" style={{ backgroundColor: '#161b22' }}>
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-sm text-slate-400 font-mono">FeatureLab Demo — Criteo CTR Dataset</span>
            </div>
            <video
              src="/demo.webm"
              autoPlay
              muted
              loop
              playsInline
              className="w-full block"
              style={{ backgroundColor: '#0d1117' }}
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 px-6 text-center text-slate-500 text-sm">
        FeatureLab — Built with Gemini, Pinecone, and Neon
      </footer>
    </div>
  )
}
