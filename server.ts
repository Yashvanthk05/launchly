import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';

const server = app.listen(env.PORT, () => {
    logger.info(`server on ${env.PORT}`);
});
