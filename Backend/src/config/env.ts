import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_VERSION: z.string().default('v1'),

  RPC_URL: z.string().url(),
  ETHEREUM_RPC_URL: z.string().url().optional(),
  ETHEREUM_TESTNET_RPC_URL: z.string().url().optional(),
  CHAIN_ID: z.string().transform(Number).default('1'),
  HOLDIS_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  HOLDIS_PAYMENTS_CORE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  HOLDIS_MILESTONES_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  HOLDIS_TEAM_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  HOLDIS_DISPUTES_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

  BLOCKRADAR_API_KEY: z.string().min(1),
  BLOCKRADAR_API_URL: z.string().url().default('https://api.blockradar.co'),
  BLOCKRADAR_WALLET_ID: z.string().min(1),
  /** Per-wallet API key (fallback for webhook verification). */
  BLOCKRADAR_WALLET_API_KEY: z.string().min(1).optional(),
  /** Per-chain wallet API keys (Blockradar uses one key per wallet; required for wallet-scoped endpoints). */
  BLOCKRADAR_WALLET_API_KEY_BASE: z.string().min(1).optional(),
  BLOCKRADAR_WALLET_API_KEY_ETHEREUM: z.string().min(1).optional(),
  BLOCKRADAR_WALLET_API_KEY_POLYGON: z.string().min(1).optional(),
  BLOCKRADAR_WALLET_API_KEY_BNB: z.string().min(1).optional(),
  BLOCKRADAR_WALLET_API_KEY_ARBITRUM: z.string().min(1).optional(),
  BLOCKRADAR_WALLET_API_KEY_OPTIMISM: z.string().min(1).optional(),
  BLOCKRADAR_WALLET_API_KEY_TRON: z.string().min(1).optional(),
  BLOCKRADAR_WALLET_API_KEY_SOLANA: z.string().min(1).optional(),
  /** Comma-separated extra keys (optional; prefer per-chain vars above). */
  BLOCKRADAR_WALLET_API_KEYS: z.string().optional(),
  BLOCKRADAR_WEBHOOK_SECRET: z.string().min(1).optional(),
  /** Set to "true" to skip webhook signature verification (debug only; not for production). */
  BLOCKRADAR_SKIP_WEBHOOK_VERIFY: z.string().optional(),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  PLATFORM_WALLET_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  PLATFORM_FEE_BASIS_POINTS: z.string().transform(Number).default('250'),

  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),

  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Email Configuration (Optional)
  EMAIL_ENABLED: z.string().optional(),
  EMAIL_PROVIDER: z.enum(['smtp', 'sendgrid', 'mailgun']).default('smtp'),
  EMAIL_FROM: z.string().optional(),
  
  // SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  
  // SendGrid
  SENDGRID_API_KEY: z.string().optional(),
  
  // Mailgun
  MAILGUN_SMTP_HOST: z.string().optional(),
  MAILGUN_SMTP_USER: z.string().optional(),
  MAILGUN_SMTP_PASSWORD: z.string().optional(),

  // Frontend URL
  FRONTEND_URL: z.string().url().optional(),

  // Admin
  ADMIN_EMAIL: z.string().email().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

export default env;
