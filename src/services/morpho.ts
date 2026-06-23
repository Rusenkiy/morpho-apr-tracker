// @ts-nocheck
import { publicClient } from '../config/chain'

export const MORPHO_BLUE_ADDRESS = '0x68e37dE8d93d3496ae143F2E900490f6280C57cD'

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
          { type: 'address' },
          { type: 'address' },
          { type: 'address' },
          { type: 'address' },
          { type: 'uint256' },
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
          { type: 'uint128' },
          { type: 'uint128' },
          { type: 'uint128' },
          { type: 'uint128' },
          { type: 'uint128' },
          { type: 'uint128' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const

export const ADAPTIVE_CURVE_IRM_ABI = [
  {
    type: 'function',
    name: 'rateAtTarget',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'int256' }],
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
  // @ts-ignore
  const result = await publicClient.readContract({
    address: MORPHO_BLUE_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    functionName: 'idToMarketParams',
    args: [marketId],
  }) as any

  return {
    loanToken: result.loanToken || result[0],
    collateralToken: result.collateralToken || result[1],
    oracle: result.oracle || result[2],
    irm: result.irm || result[3],
    lltv: result.lltv || result[4],
  }
}

export async function fetchMarketState(marketId: `0x${string}`): Promise<MarketState> {
  // @ts-ignore
  const result = await publicClient.readContract({
    address: MORPHO_BLUE_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    functionName: 'market',
    args: [marketId],
  }) as any

  return {
    totalSupplyAssets: result.totalSupplyAssets || result[0],
    totalSupplyShares: result.totalSupplyShares || result[1],
    totalBorrowAssets: result.totalBorrowAssets || result[2],
    totalBorrowShares: result.totalBorrowShares || result[3],
    lastUpdate: result.lastUpdate || result[4],
    fee: result.fee || result[5],
  }
}

export async function fetchTokenMetadata(tokenAddress: `0x${string}`): Promise<TokenMetadata> {
  try {
    // @ts-ignore
    const [symbol, name, decimals] = (await Promise.all([
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
    ])) as any

    return {
      address: tokenAddress,
      symbol,
      name,
      decimals,
    }
  } catch (err) {
    console.warn(`Failed to fetch metadata for token ${tokenAddress}:`, err)
    return {
      address: tokenAddress,
      symbol: tokenAddress === '0x0000000000000000000000000000000000000000'
        ? 'ETH'
        : tokenAddress.slice(0, 6) + '...' + tokenAddress.slice(-4),
      name: 'Unknown Token',
      decimals: 18,
    }
  }
}

export async function fetchRateAtTarget(
  irmAddress: `0x${string}`,
  marketId: `0x${string}`
): Promise<bigint> {
  if (irmAddress === '0x0000000000000000000000000000000000000000') {
    return 0n
  }
  try {
    return (await publicClient.readContract({
      address: irmAddress,
      abi: ADAPTIVE_CURVE_IRM_ABI,
      functionName: 'rateAtTarget',
      args: [marketId],
    })) as bigint
  } catch (err) {
    console.warn(`Failed to fetch rateAtTarget from IRM at ${irmAddress}:`, err)
    return 0n
  }
}
