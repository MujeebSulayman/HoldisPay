/**
 * Central service for fiat conversion rates (e.g. USD/USDC → NGN).
 * Currently backed by Quidax USDT/NGN; can add fallbacks or other providers here.
 */
import { getUsdtNgnRate } from './quidax.service';

/**
 * Returns the current USD → NGN rate (1 USD = X NGN).
 * Used for Paystack withdraw quote and execution.
 */
export async function getNgnRate(): Promise<number> {
  return getUsdtNgnRate();
}
