import { logger } from './config/logger';
import { createWorker } from './queue/worker';

logger.info("worker starting up");

createWorker();
