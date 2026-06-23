import { defineChain, createPublicClient, http, fallback } from 'viem'

export const hyperEVM = defineChain({
  id: 999,
  name: 'HyperEVM',
  nativeCurrency: {
    decimals: 18,
    name: 'HYPE',
    symbol: 'HYPE',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.hyperliquid.xyz/evm', 'https://hyperliquid.drpc.org'],
    },
  },
  blockExplorers: {
    default: { name: 'HyperEVMScan', url: 'https://hyperevmscan.io' },
  },
})

export const publicClient = createPublicClient({
  chain: hyperEVM,
  transport: fallback([
    http('https://rpc.hyperliquid.xyz/evm'),
    http('https://hyperliquid.drpc.org'),
  ]),
})
