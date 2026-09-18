import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { audit } from '../services/audit-service.js';
import { activateSimulatedPlan, getPlan, resumeSimulatedPlan, scheduleSimulatedCancellation } from '../services/plan-service.js';

export const billingRouter = express.Router();
billingRouter.use(requireAuth);

billingRouter.get('/plan', asyncHandler(async (req, res) => {
  res.json(await getPlan(req.auth.userId));
}));

billingRouter.post('/simulate-checkout', asyncHandler(async (req, res) => {
  const { planCode } = z.object({ planCode: z.enum(['SILVER', 'GOLD']) }).parse(req.body);
  const plan = await activateSimulatedPlan(req.auth.userId, planCode);
  await audit({ userId: req.auth.userId, action: 'SIMULATED_PLAN_SELECTED', resourceType: 'SUBSCRIPTION', resourceId: req.auth.userId, metadata: { planCode, periodEnd: plan.subscription.currentPeriodEnd }, ip: req.ip });
  res.json({ plan, simulated: true, message: `Plan ${plan.name} activo. Al subir a un plan superior se habilitan sus beneficios de IA desde ese momento. No se realizó ningún cobro.` });
}));

billingRouter.post('/cancel', asyncHandler(async (req, res) => {
  const plan = await scheduleSimulatedCancellation(req.auth.userId);
  await audit({ userId: req.auth.userId, action: 'SIMULATED_CANCELLATION_SCHEDULED', resourceType: 'SUBSCRIPTION', resourceId: req.auth.userId, metadata: { periodEnd: plan.subscription.currentPeriodEnd }, ip: req.ip });
  res.json({ plan, simulated: true, message: plan.subscription.currentPeriodEnd ? 'La cancelación quedó programada para el final del período simulado.' : 'No había un plan simulado de pago activo.' });
}));

billingRouter.post('/resume', asyncHandler(async (req, res) => {
  const plan = await resumeSimulatedPlan(req.auth.userId);
  await audit({ userId: req.auth.userId, action: 'SIMULATED_CANCELLATION_REVERSED', resourceType: 'SUBSCRIPTION', resourceId: req.auth.userId, ip: req.ip });
  res.json({ plan, simulated: true, message: 'La renovación automática simulada fue reanudada.' });
}));
