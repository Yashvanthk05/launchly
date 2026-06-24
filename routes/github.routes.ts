import express from 'express';
import { getUser, getRepos } from '../controllers/github.controller';

const router = express.Router();

router.get('/user', getUser);

router.get('/repos', getRepos);

export default router;
