import { Queue } from 'bullmq';
import { redis } from '../config/redis';
import { env } from '../config/env';

export const deployQueueName = env.DEPLOY_QUEUE_NAME;

export const deployQ = new Queue(deployQueueName, {
    connection: redis as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});
