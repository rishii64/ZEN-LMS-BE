import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { withTenantContext } from '../db/pool.js';
import { BadRequestError, ForbiddenError, NotFoundError, QuotaExceededError } from '../utils/errors.js';
import { signDownloadToken, verifyDownloadToken } from '../utils/crypto.js';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'text/vtt',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'audio/mpeg',
  'audio/wav',
  'video/mp4',
  'video/webm'
]);

const s3Client =
  env.STORAGE_DRIVER === 's3'
    ? new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT || undefined,
        forcePathStyle: Boolean(env.S3_ENDPOINT),
        credentials: env.S3_ACCESS_KEY_ID
          ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
          : undefined
      })
    : null;

export function inferAssetKind(mimeType) {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'text/vtt') return 'caption';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  return 'document';
}

export async function malwareScanHook(buffer, fileName) {
  // Pluggable malware scanner hook: rejects EICAR test signature or executable headers
  const textSample = buffer.subarray(0, 512).toString('utf8');
  if (textSample.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
    return 'infected';
  }
  if (fileName.toLowerCase().endsWith('.exe') || fileName.toLowerCase().endsWith('.bat')) {
    return 'infected';
  }
  return 'clean';
}

export async function saveUploadedAsset({ organizationId, userId, file, maxStorageBytes, currentStorageBytes, isReusable = true }) {
  if (!file) throw new BadRequestError('No file provided');
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new BadRequestError(`Unsupported file type: ${file.mimetype}`);
  }
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new BadRequestError(`File exceeds maximum upload limit of ${env.MAX_UPLOAD_MB} MB`);
  }
  if (Number(currentStorageBytes) + file.size > Number(maxStorageBytes)) {
    throw new QuotaExceededError('Organization storage quota exceeded. Please upgrade your subscription plan.');
  }

  const scanStatus = await malwareScanHook(file.buffer, file.originalname);
  if (scanStatus === 'infected') {
    throw new BadRequestError('File failed security/malware scan and was rejected.');
  }

  const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `${organizationId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  if (env.STORAGE_DRIVER === 's3' && s3Client) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype
      })
    );
  } else {
    const targetPath = path.join(env.LOCAL_STORAGE_DIR, storageKey);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, file.buffer);
  }

  return withTenantContext(organizationId, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO content_assets
       (organization_id, uploaded_by, file_name, storage_key, mime_type, asset_kind, size_bytes, checksum_sha256, scan_status, is_reusable)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        organizationId,
        userId,
        file.originalname,
        storageKey,
        file.mimetype,
        inferAssetKind(file.mimetype),
        file.size,
        checksum,
        scanStatus,
        isReusable
      ]
    );
    await client.query(
      `UPDATE organizations SET storage_used_bytes = storage_used_bytes + $1 WHERE id = $2`,
      [file.size, organizationId]
    );
    return rows[0];
  });
}

export async function createSignedAssetUrl(organizationId, assetId, ttlSeconds = 300) {
  const asset = await withTenantContext(organizationId, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM content_assets WHERE organization_id = $1 AND id = $2`,
      [organizationId, assetId]
    );
    return rows[0] || null;
  });
  if (!asset) throw new NotFoundError('Asset');

  if (env.STORAGE_DRIVER === 's3' && s3Client) {
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: asset.storage_key }),
      { expiresIn: ttlSeconds }
    );
    return { asset, signedUrl: url, expiresIn: ttlSeconds };
  }

  const token = signDownloadToken({ orgId: organizationId, assetId: asset.id, key: asset.storage_key }, ttlSeconds);
  return {
    asset,
    signedUrl: `${env.API_BASE_URL}/api/v1/storage/download?token=${encodeURIComponent(token)}`,
    expiresIn: ttlSeconds
  };
}

export async function readSignedLocalAsset(token) {
  const payload = verifyDownloadToken(token);
  if (!payload) throw new ForbiddenError('Invalid or expired signed URL');
  const fullPath = path.resolve(env.LOCAL_STORAGE_DIR, payload.key);
  const baseDir = path.resolve(env.LOCAL_STORAGE_DIR);
  if (!fullPath.startsWith(baseDir)) {
    throw new ForbiddenError('Invalid asset path');
  }
  const asset = await withTenantContext(payload.orgId, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM content_assets WHERE organization_id = $1 AND id = $2`,
      [payload.orgId, payload.assetId]
    );
    return rows[0] || null;
  });
  if (!asset) throw new NotFoundError('Asset');
  const buffer = await fs.readFile(fullPath);
  return { asset, buffer };
}
