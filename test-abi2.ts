import { publicClient } from './src/config/chain.ts'

const MORPHO_BLUE_ADDRESS = '0x68e37dE8d93d3496ae143F2E900490f6280C57cD'
const ABI = [
  {
    type: 'function',
    name: 'idToMarketParams',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      {
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
  }
] as const

async function check() {
  const result = await publicClient.readContract({
    address: MORPHO_BLUE_ADDRESS,
    abi: ABI,
    functionName: 'idToMarketParams',
    args: ['0xfea758e88403739fee1113b26623f43d3c37b51dc1e1e8231b78b23d1404e439'],
  })
  console.log("Array.isArray:", Array.isArray(result))
  console.log("result:", result)
}
check()
