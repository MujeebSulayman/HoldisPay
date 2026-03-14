import { invoiceService } from './invoice.service';
import { userService } from './user.service';
import { emailService } from './email.service';
import { recurrenceService } from './recurrence.service';
import { logger } from '../utils/logger';

const RUN_INTERVAL_MS = 5 * 60 * 1000; 

let intervalId: ReturnType<typeof setInterval> | null = null;

export async function runRecurringInvoiceGeneration(): Promise<void> {
  try {
    const parents = await invoiceService.getRecurringInvoicesDue();
    if (parents.length === 0) return;

    for (const parent of parents) {
      // Find the latest child to see if we need a new one
      const latestChild = await invoiceService.getLatestChildInvoice(parent.id);
      
      // If no child exists, we use the parent's creation date as the anchor
      const anchorDate = latestChild ? new Date(latestChild.created_at) : new Date(parent.created_at);
      
      const nextDate = recurrenceService.getNextOccurrenceDate(
        anchorDate, 
        parent.recurrence_interval, 
        parent.recurrence_custom_days
      );

      if (recurrenceService.isPaymentDue(nextDate)) {
        logger.info('Generating new child invoice for recurring parent', { 
          parentId: parent.id, 
          nextDate: nextDate.toISOString() 
        });

        // Generate a new invoice ID
        const newInvoiceId = BigInt(Date.now());

        await invoiceService.createInvoice({
          invoiceId: newInvoiceId,
          issuerId: parent.issuer_id,
          payerAddress: parent.payer_address,
          receiverAddress: parent.receiver_address,
          amount: parent.amount,
          tokenAddress: parent.token_address,
          requiresDelivery: parent.requires_delivery,
          description: parent.description,
          attachmentHash: parent.attachment_hash || '',
          isRecurring: false,
          parentInvoiceId: parent.id
        });

        logger.info('Successfully generated recurring invoice', { 
          parentId: parent.id, 
          newInvoiceId: newInvoiceId.toString() 
        });
      }
    }
  } catch (error) {
    logger.error('Error in recurring invoice generation job', { error });
  }
}

export async function runExpireOverdueInvoices(): Promise<void> {
  try {
    const overdue = await invoiceService.getOverduePendingInvoices();
    if (overdue.length === 0) return;

    logger.info('Expiring overdue invoices', { count: overdue.length });

    for (const inv of overdue) {
      const invoiceId = BigInt(inv.invoice_id);
      await invoiceService.updateInvoiceStatus({
        invoiceId,
        status: 'expired',
      });

      const issuer = await userService.getUserById(inv.issuer_id);
      if (issuer?.email) {
        await emailService.notifyInvoiceExpired(issuer.email, {
          invoiceId: inv.invoice_id,
          dueDate: inv.due_date,
        });
      }
    }
  } catch (error) {
    logger.error('Error in expire overdue invoices job', { error });
  }
}

export function startInvoiceExpiryScheduler(): void {
  if (intervalId) return;
  
  const runTasks = async () => {
    await runExpireOverdueInvoices();
    await runRecurringInvoiceGeneration();
  };

  runTasks();
  intervalId = setInterval(runTasks, RUN_INTERVAL_MS);
  logger.info('Invoice scheduler started (every 5 minutes)');
}

export function stopInvoiceExpiryScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Invoice scheduler stopped');
  }
}
