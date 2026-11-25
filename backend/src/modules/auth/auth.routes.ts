import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as authController from './auth.controller';
import { loginSchema } from './auth.schema';

export const authRouter = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: asha@leaveflow.local
 *               password:
 *                 type: string
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: JWT access token and user profile
 *       401:
 *         description: Invalid email or password
 */
authRouter.post('/login', validate({ body: loginSchema }), authController.login);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the authenticated user's profile
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Authenticated user details
 *       401:
 *         description: Unauthorized
 */
authRouter.get('/me', authenticate, authController.getMe);

