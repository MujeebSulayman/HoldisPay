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
