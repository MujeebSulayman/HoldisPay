import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export class SyncService {
  private readonly SYNC_KEY = 'holdis_events';

  async getLastProcessedBlock(): Promise<bigint> {
    try {
      const { data, error } = await supabase
        .from('sync_state')
        .select('last_block')
        .eq('key', this.SYNC_KEY)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch last processed block', { error });
        return 0n;
      }

      return data ? BigInt(data.last_block) : 0n;
    } catch (error) {
      logger.error('Error in getLastProcessedBlock', { error });
      return 0n;
    }
  }

  async updateLastProcessedBlock(blockNumber: bigint): Promise<void> {
    try {
      const { error } = await supabase
        .from('sync_state')
        .upsert({
          key: this.SYNC_KEY,
          last_block: blockNumber.toString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        logger.error('Failed to update last processed block', { error, blockNumber: blockNumber.toString() });
      }
    } catch (error) {
      logger.error('Error in updateLastProcessedBlock', { error });
    }
  }
}

export const syncService = new SyncService();
