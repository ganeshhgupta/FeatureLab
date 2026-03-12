'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Upload, FileText, Play, Pause, SkipForward,
  ChevronDown, Brain, Database, CheckCircle, XCircle,
  ArrowLeft, BarChart2, Eye, Lightbulb, Zap, TrendingUp,
  AlertCircle, ChevronRight
} from 'lucide-react'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface LogEntry {
  id: string
  type: string
  feature: string
  message: string
  timestamp: string
  data: Record<string, unknown>
  expanded: boolean
}

interface FeatureProfile {
  column: string
  dtype: string
  null_rate: number
  cardinality: number
  mean?: number
  std?: number
  skewness?: number
  kurtosis?: number
  correlation_with_target?: number
}

interface DatasetInfo {
  filename: string
  rows: number
  features: number
  target: string
  all_feature_columns: string[]
  numeric_columns: string[]
  categorical_columns: string[]
}

interface Progress {
  current: number
  total: number
  kept: number
  discarded: number
  kept_features: string[]
}

type AgentStatus = 'idle' | 'running' | 'completed' | 'error'

const LOG_ICONS: Record<string, React.ReactNode> = {
  observation: <Eye className="w-4 h-4 text-blue-400" />,
  hypothesis: <Lightbulb className="w-4 h-4 text-purple-400" />,
  action: <Zap className="w-4 h-4 text-blue-400" />,
  result: <TrendingUp className="w-4 h-4 text-green-400" />,
  decision: <AlertCircle className="w-4 h-4" />,
}

const LOG_BADGE_COLORS: Record<string, string> = {
  observation: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  hypothesis: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  action: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  result: 'bg-green-500/20 text-green-400 border-green-500/30',
  decision: '',
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const [dataset, setDataset] = useState<DatasetInfo | null>(null)
  const [profiles, setProfiles] = useState<FeatureProfile[]>([])
  const [status, setStatus] = useState<AgentStatus>('idle')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [progress, setProgress] = useState<Progress>({ current: 0, total: 0, kept: 0, discarded: 0, kept_features: [] })
  const [activeTab, setActiveTab] = useState<'console' | 'features'>('console')
  const [currentFeature, setCurrentFeature] = useState('')
  const [toast, setToast] = useState('')
  const [targetColumn] = useState('click')
  const logEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasLoadedDemo = useRef(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  useEffect(() => {
    if (searchParams.get('demo') === 'true' && !hasLoadedDemo.current) {
      hasLoadedDemo.current = true
      handleLoadDemo()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleLoadDemo = async () => {
    try {
      const res = await axios.post(`${API}/api/dataset/demo`)
      setDataset(res.data)
      const profileRes = await axios.get(`${API}/api/dataset/${res.data.filename}/profile`)
      setProfiles(profileRes.data.profiles)
      setProgress(p => ({ ...p, total: res.data.all_feature_columns.length }))
      showToast('Demo dataset created!')
    } catch {
      showToast('Failed to load demo dataset')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await axios.post(`${API}/api/dataset/upload`, formData)
      setDataset({
        filename: res.data.filename,
        rows: res.data.rows,
        features: res.data.features,
        target: 'click',
        all_feature_columns: res.data.columns.filter((c: string) => c !== 'click'),
        numeric_columns: [],
        categorical_columns: [],
      })
      showToast('Dataset uploaded!')
    } catch {
      showToast('Upload failed')
    }
  }

  const startAgent = useCallback(() => {
    if (!dataset) return
    setStatus('running')
    setLogs([])
    setProgress({ current: 0, total: dataset.all_feature_columns.length, kept: 0, discarded: 0, kept_features: [] })

    const body = JSON.stringify({
      dataset_path: dataset.filename,
      target_column: targetColumn,
      feature_columns: dataset.all_feature_columns.slice(0, 10),
      evaluation_threshold: 0.02,
      max_iterations_per_feature: 3,
    })

    fetch(`${API}/api/agent/run/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).then(async res => {
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))
              handleAgentEvent(event)
            } catch {
              // ignore parse errors
            }
          }
        }
      }
      setStatus('completed')
    }).catch(() => {
      setStatus('error')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, targetColumn])

  const handleAgentEvent = (event: Record<string, unknown>) => {
    const { type, feature, message, timestamp, data } = event as {
      type: string
      feature: string
      message: string
      timestamp: string
      data: Record<string, unknown>
    }

    if (type === 'feature_start') {
      setCurrentFeature(feature)
    } else if (type === 'progress') {
      const d = data as { current: number; total: number; kept: number; discarded: number; kept_features: string[] }
      setProgress({
        current: d.current,
        total: d.total,
        kept: d.kept,
        discarded: d.discarded,
        kept_features: d.kept_features || [],
      })
    } else if (type === 'complete') {
      setStatus('completed')
      const d = data as { features_kept: number; features_discarded: number; kept_features: string[] }
      setProgress(p => ({
        ...p,
        kept: d.features_kept,
        discarded: d.features_discarded,
        kept_features: d.kept_features || [],
      }))
      showToast('Agent completed all features!')
    } else if (type === 'error') {
      setStatus('error')
    }

    if (['observation', 'hypothesis', 'action', 'result', 'decision'].includes(type)) {
      setLogs(prev => [...prev, {
        id: Math.random().toString(36).slice(2),
        type,
        feature,
        message,
        timestamp,
        data,
        expanded: false,
      }])
    }
  }

  const toggleLogExpand = (id: string) => {
    setLogs(prev => prev.map(l => l.id === id ? { ...l, expanded: !l.expanded } : l))
  }

  const progressPct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-4 left-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-500/20 border border-green-500/40 text-green-300 text-sm font-medium"
          >
            <CheckCircle className="w-4 h-4" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-white/5 px-6 py-3 flex items-center justify-between bg-[#0d1117]">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[#8b949e] hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">FeatureLab</div>
              <div className="text-xs text-[#8b949e]">Feature Engineering Agent</div>
            </div>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          status === 'running' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
          status === 'completed' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
          status === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
          'bg-white/5 text-[#8b949e] border border-white/10'
        }`}>
          {status === 'running' && <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
          {status === 'completed' && <CheckCircle className="w-3 h-3" />}
          {status}
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Left Panel */}
        <div className="w-80 flex-shrink-0 border-r border-white/5 overflow-y-auto p-4 space-y-4">
          {/* Dataset Card */}
          <div className="rounded-xl border border-white/10 bg-[#161b22] p-4">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-white">Dataset</span>
            </div>

            {dataset ? (
              <div className="mb-4">
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0d1117] border border-white/5 text-sm text-white mb-1">
                  <span className="truncate">{dataset.filename.replace('.csv', '')} ({dataset.rows.toLocaleString()} rows)</span>
                  <ChevronDown className="w-4 h-4 text-[#8b949e] flex-shrink-0" />
                </div>
              </div>
            ) : (
              <div className="mb-4 px-3 py-2 rounded-lg bg-[#0d1117] border border-white/5 text-sm text-[#8b949e]">
                No dataset loaded
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:border-white/20 text-[#8b949e] hover:text-white text-sm transition-all"
              >
                <Upload className="w-3.5 h-3.5" /> Upload
              </button>
              <button
                onClick={handleLoadDemo}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:border-white/20 text-[#8b949e] hover:text-white text-sm transition-all"
              >
                <FileText className="w-3.5 h-3.5" /> Demo
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />

            {dataset && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-[#8b949e] mb-1">Rows</div>
                  <div className="text-xl font-bold text-white">{dataset.rows.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-[#8b949e] mb-1">Features</div>
                  <div className="text-xl font-bold text-white">{dataset.all_feature_columns.length}</div>
                </div>
              </div>
            )}
          </div>

          {/* Agent Controls Card */}
          <div className="rounded-xl border border-white/10 bg-[#161b22] p-4">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-white">Agent Controls</span>
            </div>

            <div className="flex items-center gap-2 mb-4">
              {status === 'idle' || status === 'completed' || status === 'error' ? (
                <button
                  onClick={startAgent}
                  disabled={!dataset}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                >
                  <Play className="w-4 h-4" />
                  {status === 'completed' ? 'Run Again' : 'Start Agent'}
                </button>
              ) : (
                <button
                  onClick={() => setStatus('idle')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-yellow-600/80 hover:bg-yellow-600 text-white text-sm font-semibold transition-colors"
                >
                  <Pause className="w-4 h-4" /> Pause
                </button>
              )}
              <button className="p-2.5 rounded-lg border border-white/10 hover:border-white/20 text-[#8b949e] hover:text-white transition-all">
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {progress.total > 0 && (
              <>
                <div className="flex justify-between text-xs text-[#8b949e] mb-1.5">
                  <span>Progress</span>
                  <span>{progress.current}/{progress.total}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full mb-4 overflow-hidden">
                  <motion.div
                    className="h-full bg-indigo-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-1.5 text-xs text-green-400 mb-1">
                      <CheckCircle className="w-3 h-3" /> Kept
                    </div>
                    <div className="text-2xl font-bold text-white">{progress.kept}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center gap-1.5 text-xs text-red-400 mb-1">
                      <XCircle className="w-3 h-3" /> Discarded
                    </div>
                    <div className="text-2xl font-bold text-white">{progress.discarded}</div>
                  </div>
                </div>

                {progress.kept_features.length > 0 && (
                  <div>
                    <div className="text-xs text-[#8b949e] mb-2">Kept Features</div>
                    <div className="flex flex-wrap gap-1.5">
                      {progress.kept_features.map(f => (
                        <span key={f} className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-white/5">
            <button
              onClick={() => setActiveTab('console')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'console'
                  ? 'text-indigo-300 border-indigo-500 bg-indigo-500/5'
                  : 'text-[#8b949e] border-transparent hover:text-white'
              }`}
            >
              <Brain className="w-4 h-4" /> Agent Console
            </button>
            <button
              onClick={() => setActiveTab('features')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'features'
                  ? 'text-indigo-300 border-indigo-500 bg-indigo-500/5'
                  : 'text-[#8b949e] border-transparent hover:text-white'
              }`}
            >
              <BarChart2 className="w-4 h-4" /> Features
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'console' && (
              <div className="rounded-xl border border-white/10 bg-[#161b22] overflow-hidden h-full">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-semibold text-white">Agent Reasoning Log</span>
                  </div>
                  {currentFeature && status === 'running' && (
                    <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono">
                      DECIDE: {currentFeature}
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-180px)]">
                  {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Brain className="w-12 h-12 text-white/10 mb-4" />
                      <p className="text-[#8b949e] text-sm">Start the agent to see reasoning logs</p>
                      <p className="text-[#8b949e]/60 text-xs mt-1">The agent will explain each step of its decision-making process</p>
                    </div>
                  ) : (
                    logs.map(log => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-3"
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {log.type === 'decision' ? (
                            (log.data as { decision?: string })?.decision === 'keep'
                              ? <CheckCircle className="w-4 h-4 text-green-400" />
                              : <XCircle className="w-4 h-4 text-red-400" />
                          ) : (
                            LOG_ICONS[log.type] || <div className="w-4 h-4 rounded-full bg-white/10" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {log.type === 'decision' ? (
                              <span className={`px-2 py-0.5 rounded border text-xs font-semibold uppercase ${
                                (log.data as { decision?: string })?.decision === 'keep'
                                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                  : 'bg-red-500/20 text-red-400 border-red-500/30'
                              }`}>
                                DECISION
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded border text-xs font-semibold uppercase ${LOG_BADGE_COLORS[log.type] || 'bg-white/10 text-white border-white/20'}`}>
                                {log.type}
                              </span>
                            )}
                            <span className="text-xs text-[#8b949e]">{log.timestamp}</span>
                          </div>
                          <p className="text-sm text-[#c9d1d9] leading-relaxed">{log.message}</p>
                          {log.data && Object.keys(log.data).length > 0 && (
                            <button
                              onClick={() => toggleLogExpand(log.id)}
                              className="mt-1.5 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                            >
                              <ChevronRight className={`w-3 h-3 transition-transform ${log.expanded ? 'rotate-90' : ''}`} />
                              {log.expanded ? 'Hide data' : 'View data'}
                            </button>
                          )}
                          <AnimatePresence>
                            {log.expanded && log.data && (
                              <motion.pre
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2 p-3 rounded-lg bg-[#0d1117] border border-white/5 text-xs text-[#8b949e] overflow-x-auto font-mono"
                              >
                                {JSON.stringify(log.data, null, 2)}
                              </motion.pre>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>
            )}

            {activeTab === 'features' && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-semibold text-white">Feature Profiles</span>
                </div>
                {profiles.length === 0 ? (
                  <div className="text-center py-20 text-[#8b949e]">
                    <BarChart2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm">Load a dataset to see feature profiles</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 xl:grid-cols-2 gap-4">
                    {profiles.map(p => (
                      <div key={p.column} className="rounded-xl border border-white/10 bg-[#161b22] p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Database className="w-3.5 h-3.5 text-[#8b949e]" />
                            <span className="text-sm font-semibold text-white">{p.column}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                            p.dtype.includes('float') ? 'bg-cyan-500/20 text-cyan-300' :
                            p.dtype.includes('int') ? 'bg-green-500/20 text-green-300' :
                            'bg-purple-500/20 text-purple-300'
                          }`}>
                            {p.dtype}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                          <div>
                            <div className="text-[#8b949e] mb-0.5">Null Rate</div>
                            <div className="text-white font-medium">{(p.null_rate * 100).toFixed(1)}%</div>
                          </div>
                          <div>
                            <div className="text-[#8b949e] mb-0.5">Cardinality</div>
                            <div className="text-white font-medium">{p.cardinality.toLocaleString()}</div>
                          </div>
                          {p.mean !== undefined && (
                            <>
                              <div>
                                <div className="text-[#8b949e] mb-0.5">Mean</div>
                                <div className="text-white font-medium">{p.mean.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-[#8b949e] mb-0.5">Skewness</div>
                                <div className="text-white font-medium">{p.skewness?.toFixed(2) ?? '—'}</div>
                              </div>
                            </>
                          )}
                          {p.correlation_with_target !== undefined && (
                            <div className="col-span-2">
                              <div className="text-[#8b949e] mb-0.5">Target Correlation</div>
                              <div className="text-white font-medium">{p.correlation_with_target.toFixed(4)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-[#8b949e]">Loading...</div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
