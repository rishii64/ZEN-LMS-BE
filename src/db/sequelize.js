import { Sequelize } from 'sequelize';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres',
  logging: env.isTest ? false : (msg) => logger.debug(msg),
  pool: {
    max: env.DB_POOL_MAX,
    min: 2,
    idle: 30000,
    acquire: 10000
  },
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

/**
 * Executes operations inside a transaction with strict PostgreSQL RLS tenant context.
 */
export async function withTenantContext(organizationId, fn) {
  if (!organizationId) {
    throw new Error('organizationId is required for tenant database context');
  }
  return sequelize.transaction(async (t) => {
    if (env.enforceAppRole) {
      await sequelize.query('SET LOCAL ROLE lms_app_user', { transaction: t });
    }
    await sequelize.query("SELECT set_config('app.is_platform_admin', 'false', true)", { transaction: t });
    await sequelize.query("SELECT set_config('app.current_organization_id', :orgId, true)", {
      replacements: { orgId: String(organizationId) },
      transaction: t
    });
    return fn(t);
  });
}

/**
 * Executes operations inside a transaction with Platform Super Admin RLS context.
 */
export async function withPlatformContext(fn) {
  return sequelize.transaction(async (t) => {
    await sequelize.query("SELECT set_config('app.is_platform_admin', 'true', true)", { transaction: t });
    await sequelize.query("SELECT set_config('app.current_organization_id', '', true)", { transaction: t });
    return fn(t);
  });
}

export async function testConnection() {
  try {
    await sequelize.authenticate();
    logger.info('Sequelize PostgreSQL connection established successfully.');
    return true;
  } catch (err) {
    logger.error({ err }, 'Unable to connect to PostgreSQL via Sequelize:');
    return false;
  }
}
