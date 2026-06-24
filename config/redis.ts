import IORedis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const redis = new IORedis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
});

redis.on('error', err => {
    logger.error({ err }, 'redis connection err');
});

redis.on('connect', () => {
    logger.info('redis connected successfully');
});
