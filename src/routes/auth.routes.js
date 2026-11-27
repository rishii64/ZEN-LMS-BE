import express from 'express';
import { z } from 'zod';
import { AuthController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

export const authRouter = express.Router();

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
  organizationId: z.string().uuid().optional(),
  mfaCode: z.string().optional()
});

const acceptInviteSchema = z.object({
  token: z.string().min(10),
  fullName: z.string().min(2).max(180),
  password: z.string().min(8).max(128),
  phone: z.string().max(40).optional()
});

authRouter.post('/login', authLimiter, validate(loginSchema), AuthController.login);
authRouter.post('/refresh', authLimiter, AuthController.refreshToken);
authRouter.post('/logout', requireAuth, AuthController.logout);
authRouter.get('/me', requireAuth, AuthController.me);
authRouter.post('/switch-org', requireAuth, AuthController.switchOrganization);
authRouter.post('/switch-organization', requireAuth, AuthController.switchOrganization);
authRouter.post('/invite/accept', authLimiter, validate(acceptInviteSchema), AuthController.acceptInvite);
authRouter.post('/mfa/setup', requireAuth, AuthController.setupMfa);
authRouter.post('/mfa/verify', requireAuth, AuthController.verifyMfa);
authRouter.post('/mfa/disable', requireAuth, AuthController.disableMfa);
const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8).max(128)
});

authRouter.post('/password/forgot', authLimiter, validate(forgotPasswordSchema), AuthController.requestPasswordReset);
authRouter.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), AuthController.requestPasswordReset);
authRouter.post('/password/reset', authLimiter, validate(resetPasswordSchema), AuthController.resetPassword);
authRouter.post('/reset-password', authLimiter, validate(resetPasswordSchema), AuthController.resetPassword);
