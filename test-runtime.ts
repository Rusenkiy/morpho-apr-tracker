import { fetchMarketParams } from './src/services/morpho.ts'

async function check() {
  const result = await fetchMarketParams('0xfea758e88403739fee1113b26623f43d3c37b51dc1e1e8231b78b23d1404e439')
  console.log(result)
}
check()
