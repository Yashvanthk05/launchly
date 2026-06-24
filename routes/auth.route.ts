import express from 'express';
import { redirectGithubLogin, githubCallback, logout } from '../controllers/auth.controller';

const router = express.Router();

router.get('/github/login', redirectGithubLogin);
router.get('/github/callback', githubCallback);
router.post('/logout', logout);

export default router;