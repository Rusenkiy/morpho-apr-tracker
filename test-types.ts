import { MORPHO_BLUE_ABI, MORPHO_BLUE_ADDRESS } from './src/services/morpho.ts'
import { publicClient } from './src/config/chain.ts'

async function check() {
  const result = await publicClient.readContract({
    address: MORPHO_BLUE_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    functionName: 'idToMarketParams',
    args: ['0xfea758e88403739fee1113b26623f43d3c37b51dc1e1e8231b78b23d1404e439']
  })
  // Let's see what TypeScript infers for result
  // If we try to access result.loanToken, what does tsc say?
  const a: string = result.loanToken;
}
