import { parseAbiItem } from 'viem';
import { paymentContractService } from './payment-contract.service';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { env } from '../config/env';

import HoldisPaymentsCoreABI from '../contracts/HoldisPaymentsCoreABI.json';
import HoldisTeamABI from '../contracts/HoldisTeamABI.json';
import HoldisDisputesABI from '../contracts/HoldisDisputesABI.json';

export class PaymentEventListenerService {
  private isRunning = false;
  private lastProcessedBlock: bigint = 0n;
  private pollingInterval = 15000;

  async start() {
    if (this.isRunning) {
      logger.warn('Payment event listener already running');
      return;
    }

    this.isRunning = true;
    logger.info('Payment event listener started');

    const currentBlock = await paymentContractService.getBlockNumber();
    this.lastProcessedBlock = currentBlock;

    this.pollEvents();
  }

  stop() {
    this.isRunning = false;
    logger.info('Payment event listener stopped');
  }

  private async pollEvents() {
    while (this.isRunning) {
      try {
        await this.processNewEvents();
        await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
      } catch (error) {
        logger.error('Error polling payment events', { error });
        await new Promise(resolve => setTimeout(resolve, this.pollingInterval * 2));
      }
    }
  }

  private async processNewEvents() {
    try {
      const currentBlock = await paymentContractService.getBlockNumber();

      if (currentBlock <= this.lastProcessedBlock) {
        return;
      }

      const fromBlock = this.lastProcessedBlock + 1n;
      const toBlock = currentBlock;

      logger.debug('Processing payment contract events', {
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
      });

      await Promise.all([
        this.processContractCreatedEvents(fromBlock, toBlock),
        this.processContractFundedEvents(fromBlock, toBlock),
        this.processPaymentReleasedEvents(fromBlock, toBlock),
        this.processTeamEvents(fromBlock, toBlock),
        this.processDisputeEvents(fromBlock, toBlock),
      ]);

      this.lastProcessedBlock = toBlock;
    } catch (error) {
      logger.error('Failed to process payment events', { error });
    }
  }

  private async processContractCreatedEvents(fromBlock: bigint, toBlock: bigint) {
    try {
      const logs = await paymentContractService.getLogs(
        env.HOLDIS_PAYMENTS_CORE_ADDRESS as `0x${string}`,
        HoldisPaymentsCoreABI,
        'ContractCreated',
        fromBlock,
        toBlock
      );

      for (const log of logs) {
        const event = (log as any).args;
        
        logger.info('Contract created event', {
          contractId: event.contractId?.toString(),
          employer: event.employer,
          contractor: event.contractor,
        });

        await supabase.from('payment_contracts').insert({
          contract_id: event.contractId?.toString(),
          employer_address: event.employer,
          contractor_address: event.contractor,
          payment_amount: event.paymentAmount?.toString(),
          payment_interval: event.paymentInterval?.toString(),
          total_amount: event.totalAmount?.toString(),
          release_type: 'PROJECT_BASED',
          status: 'ACTIVE',
          token_address: event.tokenAddress || '0x0000000000000000000000000000000000000000',
          remaining_balance: '0',
          number_of_payments: 0,
          payments_made: 0,
          start_date: new Date(),
          end_date: new Date(),
          next_payment_date: new Date(),
        });
      }
    } catch (error) {
      logger.error('Failed to process ContractCreated events', { error });
    }
  }

  private async processContractFundedEvents(fromBlock: bigint, toBlock: bigint) {
    try {
      const logs = await paymentContractService.getLogs(
        env.HOLDIS_PAYMENTS_CORE_ADDRESS as `0x${string}`,
        HoldisPaymentsCoreABI,
        'ContractFunded',
        fromBlock,
        toBlock
      );

      for (const log of logs) {
        const event = (log as any).args;
        
        logger.info('Contract funded event', {
          contractId: event.contractId?.toString(),
          amount: event.amount?.toString(),
        });

        await supabase
          .from('payment_contracts')
          .update({
            remaining_balance: event.amount?.toString(),
            updated_at: new Date().toISOString(),
          })
          .eq('contract_id', event.contractId?.toString());
      }
    } catch (error) {
      logger.error('Failed to process ContractFunded events', { error });
    }
  }

  private async processPaymentReleasedEvents(fromBlock: bigint, toBlock: bigint) {
    try {
      const logs = await paymentContractService.getLogs(
        env.HOLDIS_PAYMENTS_CORE_ADDRESS as `0x${string}`,
        HoldisPaymentsCoreABI,
        'PaymentReleased',
        fromBlock,
        toBlock
      );

      for (const log of logs) {
        const event = (log as any).args;
        
        logger.info('Payment released event', {
          contractId: event.contractId?.toString(),
          amount: event.amount?.toString(),
          paymentNumber: event.paymentNumber?.toString(),
        });

        await supabase.from('contract_payments').insert({
          contract_id: event.contractId?.toString(),
          payment_number: Number(event.paymentNumber),
          amount: event.amount?.toString(),
          paid_at: new Date(),
          tx_hash: log.transactionHash,
        });

        await supabase
          .from('payment_contracts')
          .update({
            payments_made: Number(event.paymentNumber),
            last_payment_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('contract_id', event.contractId?.toString());
      }
    } catch (error) {
      logger.error('Failed to process PaymentReleased events', { error });
    }
  }

  private async processTeamEvents(fromBlock: bigint, toBlock: bigint) {
    try {
      const [addedLogs, removedLogs, bonusLogs] = await Promise.all([
        paymentContractService.getLogs(
          env.HOLDIS_TEAM_ADDRESS as `0x${string}`,
          HoldisTeamABI,
          'TeamMemberAdded',
          fromBlock,
          toBlock
        ),
        paymentContractService.getLogs(
          env.HOLDIS_TEAM_ADDRESS as `0x${string}`,
          HoldisTeamABI,
          'TeamMemberRemoved',
          fromBlock,
          toBlock
        ),
        paymentContractService.getLogs(
          env.HOLDIS_TEAM_ADDRESS as `0x${string}`,
          HoldisTeamABI,
          'BonusAdded',
          fromBlock,
          toBlock
        ),
      ]);

      for (const log of addedLogs) {
        const event = (log as any).args;
        
        await supabase.from('contract_team_members').insert({
          contract_id: event.contractId?.toString(),
          member_address: event.memberAddress,
          share_percentage: Number(event.sharePercentage),
          is_active: true,
          added_at: new Date(),
        });
      }

      for (const log of removedLogs) {
        const event = (log as any).args;
        
        await supabase
          .from('contract_team_members')
          .update({
            is_active: false,
            removed_at: new Date().toISOString(),
          })
          .eq('contract_id', event.contractId?.toString())
          .eq('member_address', event.memberAddress);
      }

      for (const log of bonusLogs) {
        const event = (log as any).args;
        
        await supabase.from('contract_bonuses').insert({
          contract_id: event.contractId?.toString(),
          bonus_id: event.bonusId?.toString(),
          amount: event.amount?.toString(),
          reason: event.description || '',
          is_claimed: false,
          awarded_at: new Date(),
        });
      }
    } catch (error) {
      logger.error('Failed to process team events', { error });
    }
  }

  private async processDisputeEvents(fromBlock: bigint, toBlock: bigint) {
    try {
      const [raisedLogs, resolvedLogs] = await Promise.all([
        paymentContractService.getLogs(
          env.HOLDIS_DISPUTES_ADDRESS as `0x${string}`,
          HoldisDisputesABI,
          'DisputeRaised',
          fromBlock,
          toBlock
        ),
        paymentContractService.getLogs(
          env.HOLDIS_DISPUTES_ADDRESS as `0x${string}`,
          HoldisDisputesABI,
          'DisputeResolved',
          fromBlock,
          toBlock
        ),
      ]);

      for (const log of raisedLogs) {
        const event = (log as any).args;
        
        await supabase.from('contract_disputes').insert({
          contract_id: event.contractId?.toString(),
          dispute_id: event.disputeId?.toString(),
          raised_by: event.raisedBy,
          reason: event.reason,
          is_resolved: false,
          created_at: new Date(),
        });
      }

      for (const log of resolvedLogs) {
        const event = (log as any).args;
        
        await supabase
          .from('contract_disputes')
          .update({
            is_resolved: true,
            resolved_at: new Date().toISOString(),
          })
          .eq('contract_id', event.contractId?.toString())
          .eq('dispute_id', event.disputeId?.toString());
      }
    } catch (error) {
      logger.error('Failed to process dispute events', { error });
    }
  }
}

export const paymentEventListenerService = new PaymentEventListenerService();
