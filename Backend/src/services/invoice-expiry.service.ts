import { invoiceService } from './invoice.service';
import { userService } from './user.service';
import { emailService } from './email.service';
import { logger } from '../utils/logger';

const RUN_INTERVAL_MS = 5 * 60 * 1000; 

let intervalId: ReturnType<typeof setInterval> | null = null;

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
  runExpireOverdueInvoices();
  intervalId = setInterval(runExpireOverdueInvoices, RUN_INTERVAL_MS);
  logger.info('Invoice expiry scheduler started (every 5 minutes)');
}

export function stopInvoiceExpiryScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Invoice expiry scheduler stopped');
  }
}
