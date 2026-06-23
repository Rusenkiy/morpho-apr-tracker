import { useState, useEffect } from 'react'
import {
  Activity,
  TrendingUp,
  Coins,
  RefreshCw,
  Cpu,
  ExternalLink,
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import {
  fetchMarketParams,
  fetchMarketState,
  fetchTokenMetadata,
  fetchRateAtTarget,
  type MarketParams,
  type MarketState,
  type TokenMetadata,
} from './services/morpho'
import {
  simulateAdaptiveCurveIRM,
  calculateUtilization,
  calculateError,
  calculateCurve,
  calculateSupplyAPR,
  INITIAL_RATE_AT_TARGET,
  WAD,
  SECONDS_PER_YEAR,
} from './utils/simulation'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'

const PRESETS = [
  {
    id: '0xfea758e88403739fee1113b26623f43d3c37b51dc1e1e8231b78b23d1404e439',
    label: 'beHYPE / USD₮0',
  },
  {
    id: '0xff1cfb42c8731ca052c585fca4d8c8d24ca47f43bd918bcec1282370e4db4d4f',
    label: 'wmasterUSD / beatUSD',
  },
  {
    id: '0xfbe436e9aa361487f0c3e4ff94c88aea72887a4482c6b8bcfec60a8584cdb05e',
    label: 'thBILL / USD₮0',
  },
  {
    id: '0x8eecdd03f1e12e03c04abefdb3f536067e071ad2c3f63e7b04c9a034889d0ba5',
    label: 'AVLT / USD₮0',
  },
]

function App() {
  const [marketId, setMarketId] = useState<string>(PRESETS[0].id)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // On-chain state
  const [params, setParams] = useState<MarketParams | null>(null)
  const [state, setState] = useState<MarketState | null>(null)
  const [rateAtTargetVal, setRateAtTargetVal] = useState<bigint>(0n)
  const [loanToken, setLoanToken] = useState<TokenMetadata | null>(null)
  const [collateralToken, setCollateralToken] = useState<TokenMetadata | null>(null)

  // Simulation Parameters
  const simDurationDays = 45
  const simUtilizationPercent = 100

  const handleFetch = async (targetId: string) => {
    if (!targetId.startsWith('0x') || targetId.length !== 66) {
      setError('Invalid Market ID. Must be a 32-byte hex string (66 chars).')
      return
    }

    setLoading(true)
    setError(null)
    setParams(null)
    setState(null)
    setRateAtTargetVal(0n)
    setLoanToken(null)
    setCollateralToken(null)

    try {
      const parsedId = targetId as `0x${string}`
      const [fetchedParams, fetchedState] = await Promise.all([
        fetchMarketParams(parsedId),
        fetchMarketState(parsedId),
      ])

      setParams(fetchedParams)
      setState(fetchedState)

      const [fetchedRateAtTarget, loanMeta, collateralMeta] = await Promise.all([
        fetchRateAtTarget(fetchedParams.irm, parsedId),
        fetchedParams.loanToken !== '0x0000000000000000000000000000000000000000'
          ? fetchTokenMetadata(fetchedParams.loanToken)
          : Promise.resolve(null),
        fetchedParams.collateralToken !== '0x0000000000000000000000000000000000000000'
          ? fetchTokenMetadata(fetchedParams.collateralToken)
          : Promise.resolve(null),
      ])

      setRateAtTargetVal(fetchedRateAtTarget)
      setLoanToken(loanMeta)
      setCollateralToken(collateralMeta)
    } catch (err: any) {
      console.error(err)
      setError(
        err?.message ||
          'Failed to load market parameters. Verify the ID and check HyperEVM RPC connection.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    handleFetch(marketId)
  }, [])

  // Derived metrics from on-chain data
  const liveUtilization =
    state && state.totalSupplyAssets > 0n
      ? calculateUtilization(state.totalSupplyAssets, state.totalBorrowAssets)
      : 0n

  const liveErr = calculateError(liveUtilization)
  const currentAnchor = rateAtTargetVal === 0n ? INITIAL_RATE_AT_TARGET : rateAtTargetVal
  const liveBorrowRatePerSecond = calculateCurve(currentAnchor, liveErr)
  const liveSupplyAPR = state ? calculateSupplyAPR(liveBorrowRatePerSecond, liveUtilization, state.fee) : 0

  // Run the simulation using on-chain rateAtTarget as start point
  const simUtilizationWad = (BigInt(simUtilizationPercent) * WAD) / 100n
  const chartData = simulateAdaptiveCurveIRM(
    rateAtTargetVal,
    simUtilizationWad,
    simDurationDays,
    100,
    state?.fee || 0n
  )

  let currentDay: number | null = null
  if (chartData.length > 0) {
    const matchingPoint = chartData.find(d => d.supplyRateAPR >= liveSupplyAPR)
    if (matchingPoint) {
      currentDay = matchingPoint.elapsedDays
    } else {
      currentDay = simDurationDays
    }
  }

  // Formatting helper
  const formatAsset = (amount: bigint, decimals: number): string => {
    if (decimals <= 0) return amount.toLocaleString()
    const divider = 10n ** BigInt(decimals)
    const integerPart = amount / divider
    const fractionalPart = amount % divider
    let fractionalStr = fractionalPart.toString().padStart(decimals, '0')
    fractionalStr = fractionalStr.replace(/0+$/, '')
    if (fractionalStr.length < 2) {
      fractionalStr = fractionalStr.padEnd(2, '0')
    }
    return `${integerPart.toLocaleString()}.${fractionalStr}`
  }

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const isLive = currentDay !== null && Math.abs(data.elapsedDays - currentDay) <= (simDurationDays / 100)
      return (
        <div
          style={{
            background: '#040405',
            border: isLive ? '1px solid #ffcc00' : '1px solid #00ff66',
            padding: '10px 14px',
            boxShadow: isLive ? '0 0 10px rgba(255, 204, 0, 0.4)' : '0 0 10px rgba(0, 255, 102, 0.4)',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            lineHeight: '1.4',
          }}
        >
          {isLive && (
            <div style={{ color: '#ffcc00', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.9rem' }}>
              ⚡ Live Market Rate
            </div>
          )}
          <div style={{ color: '#888', marginBottom: '4px' }}>
            Day: {data.elapsedDays.toFixed(1)}
          </div>
          <div style={{ color: isLive ? '#ffcc00' : '#00ff66', fontWeight: 'bold' }}>
            Supply APR: {data.supplyRateAPR.toFixed(2)}%
          </div>
          <div style={{ color: '#e4e4e7', fontSize: '0.8rem' }}>
            Anchor Rate: {((Number(data.rateAtTarget * SECONDS_PER_YEAR * 10000n) / 10000) / 1e14).toFixed(2)}%
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="matrix-grid" />

      {/* Top Banner */}
      <header
        style={{
          borderBottom: '1px solid var(--border-color)',
          padding: '1.5rem 2rem',
          background: '#050507',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Cpu size={24} style={{ color: 'var(--accent-color)', filter: 'drop-shadow(0 0 5px var(--accent-color))' }} />
            <h1 style={{ margin: 0, fontSize: '1.4rem', letterSpacing: '0.5px', color: 'var(--accent-color)' }} className="glow-text">
              ADAPTIVE-CURVE-IRM // TRACKER
            </h1>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Morpho Blue lending simulator & live rates on HyperEVM (Chain 999)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ff66', boxShadow: '0 0 6px #00ff66' }} />
            <span style={{ color: '#888' }}>HyperEVM Client:</span>
            <span style={{ color: 'var(--accent-color)' }}>CONNECTED</span>
          </div>
          <a
            href="https://hyperevmscan.io/address/0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#888', textDecoration: 'none' }}
            className="hover-bright"
          >
            Morpho: 0xBBBB...FFCb <ExternalLink size={12} />
          </a>
        </div>
      </header>

      {/* Main Layout Container */}
      <main style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
        
        {/* Preset Selector & Market input */}
        <section className="glow-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Coins size={16} /> Market Identifier Selection
            </h2>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setMarketId(p.id)
                    handleFetch(p.id)
                  }}
                  className={`terminal-btn ${marketId === p.id ? 'terminal-btn-active' : ''}`}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
              className="terminal-input"
              style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem' }}
              placeholder="Enter 32-byte Market ID (0x...)"
            />
            <button
              onClick={() => handleFetch(marketId)}
              disabled={loading}
              className="terminal-btn"
              style={{ padding: '0.75rem 1.5rem', fontSize: '0.85rem' }}
            >
              {loading ? 'SYNCING...' : 'SYNC'}
            </button>
          </div>

          {error && (
            <div style={{ color: 'var(--danger-color)', border: '1px solid var(--danger-color)', padding: '1rem', marginTop: '1rem', background: 'rgba(255, 51, 51, 0.05)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} />
              <strong>Error:</strong> {error}
            </div>
          )}
        </section>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '1rem' }}>
            <RefreshCw className="spin" size={32} style={{ color: 'var(--accent-color)' }} />
            <div style={{ color: 'var(--accent-color)', letterSpacing: '2px', fontSize: '0.9rem' }} className="glow-text">
              LOADING SYSTEM STATE FROM THE BLOCKCHAIN...
            </div>
          </div>
        ) : (
          params && state && (
            <>
              {/* Dashboard Grid Panels */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                
                {/* On-Chain Metrics */}
                <section className="glow-panel" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1.2rem', paddingBottom: '0.4rem', borderBottom: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={15} style={{ color: 'var(--accent-color)' }} /> Current Market Metrics
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Live Utilization Rate</div>
                      <div style={{ fontSize: '1.8rem', color: 'var(--accent-color)', fontWeight: 'bold' }} className="glow-text">
                        {(Number(liveUtilization * 10000n / WAD) / 100).toFixed(2)}%
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Total Supplied</div>
                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>
                          {formatAsset(state.totalSupplyAssets, loanToken?.decimals || 18)} {loanToken?.symbol || ''}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Total Borrowed</div>
                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>
                          {formatAsset(state.totalBorrowAssets, loanToken?.decimals || 18)} {loanToken?.symbol || ''}
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Current Supply APR</div>
                        <div style={{ fontSize: '1.3rem', color: 'var(--accent-color)', fontWeight: 'bold' }} className="glow-text">
                          {liveSupplyAPR.toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Curve Anchor (Target APR)</div>
                        <div style={{ fontSize: '1.3rem', color: '#fff' }}>
                          {(Number(currentAnchor * SECONDS_PER_YEAR * 10000n / WAD) / 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Market Parameters */}
                <section className="glow-panel" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1.2rem', paddingBottom: '0.4rem', borderBottom: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Cpu size={15} style={{ color: 'var(--accent-color)' }} /> Market Specifications
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Collateral:</span>
                      <span style={{ color: '#fff', fontWeight: 'bold' }}>{collateralToken?.symbol || 'UNKNOWN'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.7rem', marginTop: '-0.3rem' }}>
                      <span>Address:</span>
                      <span style={{ wordBreak: 'break-all', textAlign: 'right' }}>{params.collateralToken}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Loan Asset:</span>
                      <span style={{ color: '#fff', fontWeight: 'bold' }}>{loanToken?.symbol || 'UNKNOWN'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.7rem', marginTop: '-0.3rem' }}>
                      <span>Address:</span>
                      <span style={{ wordBreak: 'break-all', textAlign: 'right' }}>{params.loanToken}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Liquidation LLTV:</span>
                      <span style={{ color: '#fff' }}>{(Number(params.lltv * 100n / WAD)).toFixed(0)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Oracle Contract:</span>
                      <span style={{ color: '#fff', wordBreak: 'break-all', fontSize: '0.7rem' }}>{params.oracle}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>IRM Model:</span>
                      <span style={{ color: '#fff', wordBreak: 'break-all', fontSize: '0.7rem' }}>{params.irm}</span>
                    </div>
                  </div>
                </section>



              </div>

              {/* Simulation Charts Visualizer */}
              <section className="glow-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.6rem' }}>
                  <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={15} style={{ color: 'var(--accent-color)' }} /> Projected Supply APR Trajectory
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={12} /> Duration: {simDurationDays} days
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Activity size={12} /> Utilization: {simUtilizationPercent}%
                    </div>
                  </div>
                </div>

                <div style={{ width: '100%', height: '350px', position: 'relative', background: '#040405', border: '1px solid #111', padding: '1rem 0.5rem 0.5rem 0.5rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 255, 102, 0.05)" />
                      <XAxis
                        dataKey="elapsedDays"
                        type="number"
                        domain={[0, simDurationDays]}
                        stroke="#71717a"
                        tick={{ fill: '#71717a', fontSize: '0.75rem', fontFamily: 'monospace' }}
                        tickFormatter={(v) => `Day ${v.toFixed(0)}`}
                      />
                      <YAxis
                        stroke="#71717a"
                        tick={{ fill: '#71717a', fontSize: '0.75rem', fontFamily: 'monospace' }}
                        tickFormatter={(v) => `${v.toFixed(0)}%`}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0,255,102,0.2)', strokeWidth: 1 }} />
                      {currentDay !== null && currentDay <= simDurationDays && (
                        <ReferenceLine
                          x={currentDay}
                          stroke="#ffcc00"
                          strokeDasharray="3 3"
                          label={{ position: 'top', value: currentDay === simDurationDays ? 'Live (Overheated/Max)' : 'Live Market Rate', fill: '#ffcc00', fontSize: 11 }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="supplyRateAPR"
                        name="Supply APR"
                        stroke="var(--accent-color)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#00ff66', stroke: '#000', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span>Start APR: {chartData[0].supplyRateAPR.toFixed(2)}%</span>
                  <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>Peak Simulated APR: {chartData[chartData.length - 1].supplyRateAPR.toFixed(2)}%</span>
                </div>
              </section>
            </>
          )
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '1rem', textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', background: '#050507' }}>
        SYSTEM ENGINE STACK: VITE + REACT + TYPESCRIPT + VIEM + RECHARTS. DESIGN: MINIMALIST DARK MATRIX ACCENTS.
      </footer>
    </div>
  )
}

export default App
