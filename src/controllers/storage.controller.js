import { ContentAsset, withTenantContext } from '../models/index.js';
import { createSignedAssetUrl, readSignedLocalAsset, saveUploadedAsset } from '../services/storage.service.js';

export class StorageController {
  static async downloadAsset(req, res, next) {
    try {
      const { asset, buffer } = await readSignedLocalAsset(req.query.token);
      res.setHeader('Content-Type', asset.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${asset.file_name}"`);
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  static async listAssets(req, res, next) {
    try {
      const rows = await withTenantContext(req.organizationId, async (t) => {
        return ContentAsset.findAll({
          where: { organization_id: req.organizationId },
          order: [['created_at', 'DESC']],
          limit: 100,
          transaction: t
        });
      });
      return res.status(200).json({ data: rows });
    } catch (err) {
      next(err);
    }
  }

  static async uploadAsset(req, res, next) {
    try {
      const asset = await saveUploadedAsset({
        organizationId: req.organizationId,
        userId: req.user.id,
        file: req.file,
        maxStorageBytes: req.entitlements.limits.maxStorageBytes,
        currentStorageBytes: req.organization.storage_used_bytes,
        isReusable: req.body?.isReusable !== 'false'
      });
      return res.status(201).json({ data: asset });
    } catch (err) {
      next(err);
    }
  }

  static async getSignedUrl(req, res, next) {
    try {
      const out = await createSignedAssetUrl(req.organizationId, req.params.assetId, 300);
      return res.status(200).json(out);
    } catch (err) {
      next(err);
    }
  }
}
