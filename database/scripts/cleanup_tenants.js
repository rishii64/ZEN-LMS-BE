import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../..');
const rootDir = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config({ path: path.join(backendDir, '.env') });

const { Pool } = pg;

const KEEP_SLUGS = ['acme-corp', 'horizon-edu'];

export async function cleanupOtherTenants({ dryRun = false } = {}) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required.');
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_platform_admin', 'true', true)");

    const toKeep = await client.query(
      `SELECT id, slug, name FROM organizations WHERE slug = ANY($1::text[])`,
      [KEEP_SLUGS]
    );

    const toDelete = await client.query(
      `SELECT id, slug, name FROM organizations WHERE slug <> ALL($1::text[])`,
      [KEEP_SLUGS]
    );

    const deleteIds = toDelete.rows.map((r) => r.id);

    if (dryRun) {
      const orphanPreview = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM users u
         WHERE u.is_platform_admin = FALSE
           AND NOT EXISTS (
             SELECT 1 FROM organization_memberships m
             JOIN organizations o ON o.id = m.organization_id
             WHERE m.user_id = u.id AND o.slug = ANY($1::text[])
           )`,
        [KEEP_SLUGS]
      );
      await client.query('ROLLBACK');
      console.log('[cleanup:dry-run] Keeping tenants:', toKeep.rows.map((r) => `${r.name} (${r.slug})`));
      console.log(`[cleanup:dry-run] Would delete ${deleteIds.length} tenant(s) and ${orphanPreview.rows[0].cnt} orphaned user(s).`);
      return { kept: toKeep.rows.length, deletedTenants: deleteIds.length, deletedUsers: orphanPreview.rows[0].cnt };
    }

    let deletedTenants = 0;
    if (deleteIds.length > 0) {
      await client.query(
        `UPDATE sessions SET active_organization_id = NULL WHERE active_organization_id = ANY($1::uuid[])`,
        [deleteIds]
      );
      await client.query(
        `DELETE FROM audit_logs WHERE organization_id = ANY($1::uuid[])`,
        [deleteIds]
      );
      await client.query(
        `DELETE FROM background_job_records WHERE organization_id = ANY($1::uuid[])`,
        [deleteIds]
      );

      const delRes = await client.query(
        `DELETE FROM organizations WHERE id = ANY($1::uuid[])`,
        [deleteIds]
      );
      deletedTenants = delRes.rowCount;
    }

    // Remove non-platform-admin users who no longer belong to any remaining tenant
    const delUsersRes = await client.query(
      `DELETE FROM users u
       WHERE u.is_platform_admin = FALSE
         AND NOT EXISTS (
           SELECT 1 FROM organization_memberships m WHERE m.user_id = u.id
         )`
    );

    await client.query('COMMIT');
    console.log(`[cleanup] Kept ${toKeep.rows.length} tenant(s): ${toKeep.rows.map((r) => r.slug).join(', ')}`);
    console.log(`[cleanup] Deleted ${deletedTenants} tenant(s) and ${delUsersRes.rowCount} orphaned user(s).`);
    return { kept: toKeep.rows.length, deletedTenants, deletedUsers: delUsersRes.rowCount };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[cleanup] Failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase()
) {
  const dryRun = process.argv.includes('--dry-run');
  cleanupOtherTenants({ dryRun }).catch(() => process.exit(1));
}
