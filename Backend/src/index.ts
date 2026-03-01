import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { eventListenerService } from './services/event-listener.service';
import { paymentEventListenerService } from './services/payment-event-listener.service';
import { webhookService } from './services/webhook.service';
import { startInvoiceExpiryScheduler, stopInvoiceExpiryScheduler } from './services/invoice-expiry.service';

const PORT = env.PORT || 3000;

async function bootstrap() {
  try {
    logger.info('🚀 Starting HoldisPay Backend...');
    if (env.BLOCKRADAR_SKIP_WEBHOOK_VERIFY === 'true') {
      logger.warn('⚠️ BLOCKRADAR_SKIP_WEBHOOK_VERIFY is enabled — webhook signature verification is disabled (debug only)');
    }
    const webhookKeyCount = webhookService.getWebhookVerificationKeyCount();
    logger.info(`🔐 Webhook verification: ${webhookKeyCount} key(s) configured (set BLOCKRADAR_WALLET_API_KEY_ETHEREUM etc. on Render for each chain)`);

    const app = createApp();

    const server = app.listen(PORT, () => {
      logger.info(`✅ HTTP Server listening on port ${PORT}`);
      logger.info(`🌍 Environment: ${env.NODE_ENV}`);
      logger.info(`📡 Chain: ${env.CHAIN_ID}`);
      logger.info(`📝 Invoice Contract: ${env.HOLDIS_CONTRACT_ADDRESS}`);
      logger.info(`💰 Payment Core: ${env.HOLDIS_PAYMENTS_CORE_ADDRESS}`);
      logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
    });

    logger.info('🔗 Starting blockchain event listeners...');
    await eventListenerService.start();
    await paymentEventListenerService.start();
    logger.info('✅ Event listeners started');

    startInvoiceExpiryScheduler();

    const shutdown = async () => {
      logger.info('📴 Shutting down gracefully...');

      server.close(() => {
        logger.info('✅ HTTP server closed');
      });

      eventListenerService.stop();
      paymentEventListenerService.stop();
      stopInvoiceExpiryScheduler();
      logger.info('✅ Event listeners stopped');

      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

bootstrap();
