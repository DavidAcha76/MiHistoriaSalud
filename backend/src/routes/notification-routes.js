import express from 'express';
import { z } from 'zod';
import { db } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

export const notificationRouter = express.Router();
notificationRouter.use(requireAuth);

notificationRouter.get('/', asyncHandler(async (req, res) => {
  const [rows] = await db.execute(
    `SELECT id, profile_id AS profileId, notification_type AS notificationType, title, body, read_at AS readAt, created_at AS createdAt
       FROM in_app_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30`,
    [req.auth.userId]
  );
  res.json(rows);
}));

notificationRouter.patch('/:notificationId/read', asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.notificationId);
  await db.execute('UPDATE in_app_notifications SET read_at=COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id=? AND user_id=?', [id, req.auth.userId]);
  res.status(204).end();
}));
