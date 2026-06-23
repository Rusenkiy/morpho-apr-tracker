import { useState, useEffect } from 'react'
import {
  fetchMarketParams,
  fetchMarketState,
  fetchTokenMetadata,
  type MarketParams,
  type MarketState,
  type TokenMetadata,
} from './services/morpho'

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
]

function App() {
  const [marketId, setMarketId] = useState<string>(PRESETS[0].id)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  
  const [params, setParams] = useState<MarketParams | null>(null)
  const [state, setState] = useState<MarketState | null>(null)
  const [loanToken, setLoanToken] = useState<TokenMetadata | null>(null)
  const [collateralToken, setCollateralToken] = useState<TokenMetadata | null>(null)

  const handleFetch = async (targetId: string) => {
    if (!targetId.startsWith('0x') || targetId.length !== 66) {
      setError('Invalid Market ID format. Must be a 32-byte hex string (66 characters starting with 0x).')
      return
    }

    setLoading(true)
    setError(null)
    setParams(null)
    setState(null)
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

      // Fetch token info if addresses are valid
      const [loanMeta, collateralMeta] = await Promise.all([
        fetchedParams.loanToken !== '0x0000000000000000000000000000000000000000'
          ? fetchTokenMetadata(fetchedParams.loanToken)
          : Promise.resolve(null),
        fetchedParams.collateralToken !== '0x0000000000000000000000000000000000000000'
          ? fetchTokenMetadata(fetchedParams.collateralToken)
          : Promise.resolve(null),
      ])

      setLoanToken(loanMeta)
      setCollateralToken(collateralMeta)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Failed to fetch market details. Make sure the ID is correct and HyperEVM RPC is active.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    handleFetch(marketId)
  }, [])

  // Helper to safely format bigints
  const stringifyData = (data: any) => {
    return JSON.stringify(
      data,
      (_, val) => (typeof val === 'bigint' ? val.toString() : val),
      2
    )
  }

  return (
    <div style={{
      fontFamily: 'monospace',
      background: '#0a0a0a',
      color: '#00ff66',
      minHeight: '100vh',
      padding: '2rem',
      boxSizing: 'border-box'
    }}>
      <header style={{ borderBottom: '1px solid #00ff66', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', textShadow: '0 0 8px #00ff66' }}>
          MORPHO BLUE / HYPEREVM CONNECTOR VALIDATION
        </h1>
        <p style={{ margin: '0.5rem 0 0 0', color: '#888' }}>
          Step 1 verification: Web3 configuration & contract reader
        </p>
      </header>

      <main style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        <section style={{ border: '1px solid #00ff66', padding: '1.5rem', background: '#0e0e0e' }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>Select Preset or Enter Market ID</h2>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setMarketId(p.id)
                  handleFetch(p.id)
                }}
                style={{
                  background: marketId === p.id ? '#00ff66' : 'transparent',
                  color: marketId === p.id ? '#000' : '#00ff66',
                  border: '1px solid #00ff66',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                  transition: 'all 0.2s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
              style={{
                flex: 1,
                background: '#141414',
                color: '#00ff66',
                border: '1px solid #00ff66',
                padding: '0.8rem',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
              }}
              placeholder="0x..."
            />
            <button
              onClick={() => handleFetch(marketId)}
              disabled={loading}
              style={{
                background: '#00ff66',
                color: '#000',
                border: 'none',
                padding: '0.8rem 1.5rem',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                fontSize: '0.9rem',
              }}
            >
              {loading ? 'FETCHING...' : 'FETCH'}
            </button>
          </div>

          {error && (
            <div style={{ color: '#ff3333', marginTop: '1rem', border: '1px solid #ff3333', padding: '1rem', background: '#221111' }}>
              ERROR: {error}
            </div>
          )}
        </section>

        {loading && (
          <div style={{ textShadow: '0 0 5px #00ff66', fontSize: '1.2rem', textAlign: 'center', margin: '2rem 0' }}>
            &gt;&gt; ESTABLISHING RPC CALLS TO HYPEREVM...
          </div>
        )}

        {!loading && (params || state) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <section style={{ border: '1px solid #00ff66', padding: '1.5rem', background: '#0e0e0e' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', borderBottom: '1px dashed #00ff66', paddingBottom: '0.5rem' }}>
                MARKET PARAMS (idToMarketParams)
              </h3>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.85rem' }}>
                {params ? stringifyData(params) : 'No params fetched'}
              </pre>
            </section>

            <section style={{ border: '1px solid #00ff66', padding: '1.5rem', background: '#0e0e0e' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', borderBottom: '1px dashed #00ff66', paddingBottom: '0.5rem' }}>
                MARKET STATE (market)
              </h3>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.85rem' }}>
                {state ? stringifyData(state) : 'No state fetched'}
              </pre>
            </section>

            <section style={{ border: '1px solid #00ff66', padding: '1.5rem', background: '#0e0e0e', gridColumn: '1 / -1' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', borderBottom: '1px dashed #00ff66', paddingBottom: '0.5rem' }}>
                TOKEN METADATA
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#888' }}>Loan Token</h4>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                    {loanToken ? stringifyData(loanToken) : 'No loan token info (native HYPE gas asset or empty)'}
                  </pre>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#888' }}>Collateral Token</h4>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                    {collateralToken ? stringifyData(collateralToken) : 'No collateral token info'}
                  </pre>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
