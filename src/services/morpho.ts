import { publicClient } from '../config/chain'

export const MORPHO_BLUE_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb'

export const MORPHO_BLUE_ABI = [
  {
    type: 'function',
    name: 'idToMarketParams',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'market',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      {
        name: 'marketState',
        type: 'tuple',
        components: [
          { name: 'totalSupplyAssets', type: 'uint128' },
          { name: 'totalSupplyShares', type: 'uint128' },
          { name: 'totalBorrowAssets', type: 'uint128' },
          { name: 'totalBorrowShares', type: 'uint128' },
          { name: 'lastUpdate', type: 'uint128' },
          { name: 'fee', type: 'uint128' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
] as const

export interface MarketParams {
  loanToken: `0x${string}`
  collateralToken: `0x${string}`
  oracle: `0x${string}`
  irm: `0x${string}`
  lltv: bigint
}

export interface MarketState {
  totalSupplyAssets: bigint
  totalSupplyShares: bigint
  totalBorrowAssets: bigint
  totalBorrowShares: bigint
  lastUpdate: bigint
  fee: bigint
}

export interface TokenMetadata {
  address: `0x${string}`
  symbol: string
  name: string
  decimals: number
}

export async function fetchMarketParams(marketId: `0x${string}`): Promise<MarketParams> {
  const result = await publicClient.readContract({
    address: MORPHO_BLUE_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    functionName: 'idToMarketParams',
    args: [marketId],
  })

  return {
    loanToken: result.loanToken,
    collateralToken: result.collateralToken,
    oracle: result.oracle,
    irm: result.irm,
    lltv: result.lltv,
  }
}

export async function fetchMarketState(marketId: `0x${string}`): Promise<MarketState> {
  const result = await publicClient.readContract({
    address: MORPHO_BLUE_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    functionName: 'market',
    args: [marketId],
  })

  return {
    totalSupplyAssets: result.totalSupplyAssets,
    totalSupplyShares: result.totalSupplyShares,
    totalBorrowAssets: result.totalBorrowAssets,
    totalBorrowShares: result.totalBorrowShares,
    lastUpdate: result.lastUpdate,
    fee: result.fee,
  }
}

export async function fetchTokenMetadata(tokenAddress: `0x${string}`): Promise<TokenMetadata> {
  const [symbol, name, decimals] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'symbol',
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'name',
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }),
  ])

  return {
    address: tokenAddress,
    symbol,
    name,
    decimals,
  }
}
