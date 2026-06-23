/**
 * AdaptiveCurveIRM Math Simulation Utility
 * Replicates the exact fixed-point math from Morpho Blue's AdaptiveCurveIrm Solidity contract.
 */

// Math constants matching Solidity equivalents
export const WAD = 1000000000000000000n
export const SECONDS_PER_YEAR = 31536000n

// Constants from ConstantsLib.sol
export const CURVE_STEEPNESS = 4000000000000000000n // 4 ether
export const TARGET_UTILIZATION = 900000000000000000n // 0.9 ether
export const INITIAL_RATE_AT_TARGET = 40000000000000000n / SECONDS_PER_YEAR // 0.04 ether / 365 days
export const ADJUSTMENT_SPEED = 50000000000000000000n / SECONDS_PER_YEAR // 50 ether / 365 days
export const MIN_RATE_AT_TARGET = 1000000000000000n / SECONDS_PER_YEAR // 0.001 ether / 365 days
export const MAX_RATE_AT_TARGET = 2000000000000000000n / SECONDS_PER_YEAR // 2.0 ether / 365 days

// Constants from ExpLib.sol
const LN_2 = 693147180559945309n
const LN_WEI = -41446531673892822312n
const WEXP_UPPER_BOUND = 93859467695000404319n
const WEXP_UPPER_VALUE = 57716089161558943949701069502944508345128422502756744429568n

/**
 * Fixed-point division rounded towards zero (WAD)
 */
export function wDivToZero(x: bigint, y: bigint): bigint {
  return (x * WAD) / y
}

/**
 * Fixed-point multiplication rounded towards zero (WAD)
 */
export function wMulToZero(x: bigint, y: bigint): bigint {
  return (x * y) / WAD
}

/**
 * Bounds a value between low and high
 */
export function bound(x: bigint, low: bigint, high: bigint): bigint {
  if (low > high) return low
  if (x < low) return low
  if (x > high) return high
  return x
}

/**
 * Approximates exp(x) in WAD fixed-point math (matching ExpLib.sol)
 */
export function wExp(x: bigint): bigint {
  if (x < LN_WEI) return 0n
  if (x >= WEXP_UPPER_BOUND) return WEXP_UPPER_VALUE

  const roundingAdjustment = x < 0n ? -(LN_2 / 2n) : LN_2 / 2n
  const q = (x + roundingAdjustment) / LN_2
  const r = x - q * LN_2

  // expR = WAD + r + (r^2) / (2 * WAD)
  const expR = WAD + r + (r * r) / WAD / 2n

  if (q >= 0n) {
    return expR << q
  } else {
    return expR >> -q
  }
}

/**
 * Calculates current market utilization
 */
export function calculateUtilization(totalSupplyAssets: bigint, totalBorrowAssets: bigint): bigint {
  if (totalSupplyAssets === 0n) return 0n
  // totalBorrowAssets * WAD / totalSupplyAssets
  return (totalBorrowAssets * WAD) / totalSupplyAssets
}

/**
 * Calculates the normalization error (err)
 */
export function calculateError(utilization: bigint): bigint {
  const errNormFactor = utilization > TARGET_UTILIZATION
    ? WAD - TARGET_UTILIZATION
    : TARGET_UTILIZATION

  // (utilization - TARGET_UTILIZATION) * WAD / errNormFactor
  return wDivToZero(utilization - TARGET_UTILIZATION, errNormFactor)
}

/**
 * Computes interest rate for a given rateAtTarget and err
 */
export function calculateCurve(rateAtTargetVal: bigint, err: bigint): bigint {
  const coeff = err < 0n
    ? WAD - wDivToZero(WAD, CURVE_STEEPNESS)
    : CURVE_STEEPNESS - WAD

  // factor = (coeff * err / WAD) + WAD
  const factor = wMulToZero(coeff, err) + WAD
  return wMulToZero(factor, rateAtTargetVal)
}

/**
 * Computes the new rate at target after linearAdaptation has elapsed
 */
export function calculateNewRateAtTarget(startRateAtTarget: bigint, linearAdaptation: bigint): bigint {
  const rateVal = startRateAtTarget === 0n ? INITIAL_RATE_AT_TARGET : startRateAtTarget
  return bound(
    wMulToZero(rateVal, wExp(linearAdaptation)),
    MIN_RATE_AT_TARGET,
    MAX_RATE_AT_TARGET
  )
}

export interface SimulationPoint {
  elapsedSeconds: number
  elapsedDays: number
  rateAtTarget: bigint
  borrowRatePerSecond: bigint
  borrowRateAPR: number // formatted as percentage (e.g. 12.34%)
  supplyRateAPR: number // formatted as percentage
}

/**
 * Calculates the Supply APR based on Borrow Rate, Utilization, and Fee.
 * Fee is expected in WAD format (e.g., 1e18 = 100%).
 */
export function calculateSupplyAPR(borrowRatePerSecond: bigint, utilization: bigint, fee: bigint): number {
  const supplyRatePerSecond = wMulToZero(borrowRatePerSecond, utilization)
  const supplyRateWithFee = wMulToZero(supplyRatePerSecond, WAD - fee)
  return Number(supplyRateWithFee * SECONDS_PER_YEAR * 10000n / WAD) / 100
}

/**
 * Projects the borrow rate over time assuming utilization is constant
 *
 * @param startRateAtTarget Current rateAtTarget value read from the contract
 * @param utilization WAD value representing constant simulated utilization (defaults to 100%)
 * @param durationDays Number of days into the future to project
 * @param pointsCount Number of data points to generate for charting
 * @param fee The fee represented in WAD (defaults to 0)
 */
export function simulateAdaptiveCurveIRM(
  startRateAtTarget: bigint,
  utilization: bigint = WAD, // Defaults to 100%
  durationDays: number = 30,
  pointsCount: number = 100,
  fee: bigint = 0n
): SimulationPoint[] {
  const finalRateAtTarget = startRateAtTarget === 0n ? INITIAL_RATE_AT_TARGET : startRateAtTarget
  const err = calculateError(utilization)
  const speed = wMulToZero(ADJUSTMENT_SPEED, err)

  const durationSeconds = BigInt(durationDays * 24 * 3600)
  const stepSeconds = durationSeconds / BigInt(pointsCount)

  const points: SimulationPoint[] = []

  for (let i = 0; i <= pointsCount; i++) {
    const elapsedSeconds = BigInt(i) * stepSeconds
    const elapsedDays = Number(elapsedSeconds) / (24 * 3600)

    const linearAdaptation = speed * elapsedSeconds
    const rateAtTarget_t = calculateNewRateAtTarget(finalRateAtTarget, linearAdaptation)
    const borrowRatePerSecond = calculateCurve(rateAtTarget_t, err)

    // Convert per-second rate to annual percentage rate (APR)
    // APR = rate * SECONDS_PER_YEAR * 100 %
    const aprPercent = Number(borrowRatePerSecond * SECONDS_PER_YEAR * 10000n / WAD) / 100
    const supplyAprPercent = calculateSupplyAPR(borrowRatePerSecond, utilization, fee)

    points.push({
      elapsedSeconds: Number(elapsedSeconds),
      elapsedDays,
      rateAtTarget: rateAtTarget_t,
      borrowRatePerSecond,
      borrowRateAPR: aprPercent,
      supplyRateAPR: supplyAprPercent,
    })
  }

  return points
}
