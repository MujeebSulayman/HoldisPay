/**
 * Chain config and API keys. Source of truth is enabled-chains (env-driven).
 * No hardcoded chain or asset lists; logos/metadata come from Blockradar API.
 */

export type { ChainConfig } from './enabled-chains';
export {
  getChainConfig,
  getAvailableChains,
  getEVMChains,
} from './enabled-chains';

import { getWalletApiKeyForChain } from './enabled-chains';

export function getBlockradarApiKeyForChain(chainSlug: string): string {
  return getWalletApiKeyForChain(chainSlug) ?? process.env.BLOCKRADAR_API_KEY ?? '';
}
