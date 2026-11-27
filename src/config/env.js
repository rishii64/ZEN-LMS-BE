import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@127.0.0.1:5432/lms_saas'),
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),
  DB_ENFORCE_APP_ROLE: z.string().optional().default('false'),
  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-in-production-32chars'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-in-production-32chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),
  MFA_ENCRYPTION_KEY: z.string().min(16).default('dev-mfa-32-char-encryption-key!!'),
  SIGNED_URL_SECRET: z.string().min(16).default('dev-signed-url-hmac-secret-key!!'),
  REDIS_ENABLED: z.string().optional().default('false'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default(path.resolve(__dirname, '../storage_uploads')),
  S3_BUCKET: z.string().default('lms-enterprise-assets'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(100),
  PAYMENT_DEFAULT_PROVIDER: z.enum(['stripe', 'razorpay']).default('stripe'),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  MAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().default('noreply@lms-platform.local')
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed');
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  redisEnabled: parsed.data.REDIS_ENABLED === 'true',
  enforceAppRole: parsed.data.DB_ENFORCE_APP_ROLE === 'true'
};
