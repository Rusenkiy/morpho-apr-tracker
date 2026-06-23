import { publicClient } from './src/config/chain.ts'
import { MORPHO_BLUE_ADDRESS, MORPHO_BLUE_ABI } from './src/services/morpho.ts'

async function check() {
  const { loanToken, collateralToken, oracle, irm, lltv } = await publicClient.readContract({
    address: MORPHO_BLUE_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    functionName: 'idToMarketParams',
    args: ['0xfea758e88403739fee1113b26623f43d3c37b51dc1e1e8231b78b23d1404e439'],
  })
}
