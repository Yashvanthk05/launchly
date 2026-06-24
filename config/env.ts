import { z } from 'zod';

const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'production']).default('development'),
    PORT: z
        .string()
        .default('3000')
        .transform(val => parseInt(val, 10)),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z
        .string()
        .default('6379')
        .transform(val => parseInt(val, 10)),
    REDIS_PASSWORD: z.string().optional(),
    GITHUB_CLIENT: z.string(),
    GITHUB_SECRET: z.string(),
    GITHUB_REDIRECT_URL: z.string(),
    CSRF_SECRET: z.string().optional(),
    DEPLOY_QUEUE_NAME: z.string(),
});

const _env = EnvSchema.safeParse(process.env);

if (!_env.success) {
    console.error('ENV schema error');
    console.error(_env.error);
    process.exit(1);
}

export const env = _env.data;
