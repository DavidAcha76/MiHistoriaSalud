import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { assertProfileAccess } from '../middleware/profile-access.js';
import { asyncHandler } from '../utils/async-handler.js';
import { audit } from '../services/audit-service.js';
import { buildConsultationSummary } from '../services/summary-service.js';

export const summaryRouter = express.Router();
summaryRouter.use(requireAuth);

summaryRouter.get('/profiles/:profileId/consultation-summary', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId);
  const summary = await buildConsultationSummary(profile);
  await audit({ userId: req.auth.userId, profileId: profile.id, action: 'READ', resourceType: 'CONSULTATION_SUMMARY', resourceId: profile.id, ip: req.ip });
  res.json(summary);
}));
