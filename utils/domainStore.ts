import path from 'node:path';
import fs from 'node:fs/promises';
import { prisma } from './db';
import { redis } from '../config/redis';

const FILEPATH = path.join(process.cwd(), 'domain-map.json');
const REDIS_KEY_PREFIX = 'domain:';
const REDIS_SET_KEY = 'domains:all';

async function readFileSafe() {
    try {
        const data = await fs.readFile(FILEPATH, 'utf-8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

export const setDomain = async (domain: string, port: number, projectId?: string) => {
    await redis.set(`${REDIS_KEY_PREFIX}${domain}`, String(port));
    await redis.sadd(REDIS_SET_KEY, domain);

    const data = await readFileSafe();
    data[domain] = port;
    await fs.writeFile(FILEPATH, JSON.stringify(data, null, 2));

    if (projectId) {
        try {
            await prisma.domain.upsert({
                where: { domain },
                update: { port, projectId },
                create: { domain, port, projectId },
            });
        } catch (e) {
            console.error('Failed to save domain to DB:', e);
        }
    }
};

export const getDomain = async (domain: string) => {
    const portStr = await redis.get(`${REDIS_KEY_PREFIX}${domain}`);
    if (portStr) return Number(portStr);

    const data = await readFileSafe();
    if (data[domain]) return data[domain];

    try {
        const record = await prisma.domain.findUnique({ where: { domain } });
        if (record?.port) return record.port;
    } catch {}

    return null;
};

export const removeDomain = async (domain: string) => {
    await redis.del(`${REDIS_KEY_PREFIX}${domain}`);
    await redis.srem(REDIS_SET_KEY, domain);

    const data = await readFileSafe();
    delete data[domain];
    await fs.writeFile(FILEPATH, JSON.stringify(data, null, 2));

    try {
        await prisma.domain.delete({ where: { domain } });
    } catch {}
};

export const getAllDomainPorts = async (): Promise<Record<string, number>> => {
    const members = await redis.smembers(REDIS_SET_KEY);
    if (members.length === 0) {
        return await readFileSafe();
    }
    const result: Record<string, number> = {};
    for (const domain of members) {
        const portStr = await redis.get(`${REDIS_KEY_PREFIX}${domain}`);
        if (portStr) result[domain] = Number(portStr);
    }
    return result;
};