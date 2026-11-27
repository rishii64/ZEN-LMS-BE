import express from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { StorageController } from '../controllers/storage.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';

export const storageRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 }
});

// Signed download endpoint (short-lived HMAC verified token, no tenant session required)
storageRouter.get('/download', StorageController.downloadAsset);

storageRouter.use(requireAuth, resolveTenant);
storageRouter.get('/assets', StorageController.listAssets);
storageRouter.post('/upload', upload.single('file'), StorageController.uploadAsset);
storageRouter.get('/:assetId/signed-url', StorageController.getSignedUrl);
