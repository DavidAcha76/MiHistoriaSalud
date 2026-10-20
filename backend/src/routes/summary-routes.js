import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { assertProfileAccess } from '../middleware/profile-access.js';
import { asyncHandler } from '../utils/async-handler.js';
import { audit } from '../services/audit-service.js';
import { buildConsultationSummary, SUMMARY_SECTIONS } from '../services/summary-service.js';

export const summaryRouter = express.Router();
summaryRouter.use(requireAuth);

// RF-25: `sections` limita la vista a las secciones elegidas; sin el parámetro se muestran todas.
const sectionsSchema = z.string().max(300).optional().transform((value) => {
  if (!value) return SUMMARY_SECTIONS;
  const requested = value.split(',').map((item) => item.trim()).filter(Boolean);
  return z.array(z.enum(SUMMARY_SECTIONS)).min(1).parse(requested);
});

summaryRouter.get('/profiles/:profileId/consultation-summary', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId);
  const sections = sectionsSchema.parse(req.query.sections);
  const summary = await buildConsultationSummary(profile, sections);
  await audit({ userId: req.auth.userId, profileId: profile.id, action: 'READ', resourceType: 'CONSULTATION_SUMMARY', resourceId: profile.id, metadata: { selectedCount: sections.length }, ip: req.ip });
  res.json(summary);
}));
