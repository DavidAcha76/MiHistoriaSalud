import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { assertProfileAccess } from '../middleware/profile-access.js';
import { asyncHandler } from '../utils/async-handler.js';
import { audit } from '../services/audit-service.js';
import { confirmMedicationDose, createMedicationRegimen, listMedicationRegimens, setMedicationRegimenActive } from '../services/medication-service.js';

export const medicationRouter = express.Router();
medicationRouter.use(requireAuth);

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa un horario válido, por ejemplo 08:00.');
const unique = (values) => new Set(values).size === values.length;
const regimenSchema = z.object({
  medicationName: z.string().trim().min(2, 'Escribe el nombre del medicamento.').max(180),
  dose: z.string().trim().max(120).optional().nullable(),
  scheduleDays: z.array(z.number().int().min(0).max(6)).min(1, 'Selecciona al menos un día.').max(7).refine(unique, 'No repitas días.'),
  scheduleTimes: z.array(time).min(1, 'Añade al menos una hora.').max(4).refine(unique, 'No repitas horarios.'),
  startDate: z.string().date(),
  notes: z.string().trim().max(5000).optional().nullable()
});
const confirmationSchema = z.object({ scheduledDate: z.string().date(), scheduledTime: time });
const activeSchema = z.object({ isActive: z.boolean() });

medicationRouter.get('/profiles/:profileId/medication-regimens', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  res.json(await listMedicationRegimens(req.params.profileId));
}));

medicationRouter.post('/profiles/:profileId/medication-regimens', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const body = regimenSchema.parse(req.body);
  const regimen = await createMedicationRegimen({ profileId: req.params.profileId, userId: req.auth.userId, body });
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'CREATE', resourceType: 'MEDICATION_REGIMEN', resourceId: regimen.id, metadata: { medicationName: regimen.medicationName }, ip: req.ip });
  res.status(201).json(regimen);
}));

medicationRouter.post('/profiles/:profileId/medication-regimens/:regimenId/confirm', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const body = confirmationSchema.parse(req.body);
  const dose = await confirmMedicationDose({ profileId: req.params.profileId, regimenId: req.params.regimenId, ...body });
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'CONFIRM', resourceType: 'MEDICATION_DOSE', resourceId: req.params.regimenId, metadata: { scheduledDate: body.scheduledDate, scheduledTime: body.scheduledTime }, ip: req.ip });
  res.json(dose);
}));

medicationRouter.patch('/profiles/:profileId/medication-regimens/:regimenId', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const { isActive } = activeSchema.parse(req.body);
  const regimen = await setMedicationRegimenActive({ profileId: req.params.profileId, regimenId: req.params.regimenId, isActive });
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: isActive ? 'RESUME' : 'PAUSE', resourceType: 'MEDICATION_REGIMEN', resourceId: regimen.id, ip: req.ip });
  res.json(regimen);
}));
