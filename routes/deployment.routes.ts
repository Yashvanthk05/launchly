import express from 'express';
import { createDeployment, getDeploymentStatus, getUserDeployments } from '../controllers/deployment.controller';

const router = express.Router();

router.post('/create', createDeployment);
router.get('/status', getDeploymentStatus);
router.get('/user-deployments', getUserDeployments);

export default router;
