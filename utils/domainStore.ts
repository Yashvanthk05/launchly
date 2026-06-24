import path from 'node:path';
import fs from 'node:fs/promises';
import { prisma } from './db';

const FILEPATH = path.join(process.cwd(), 'domain-map.json');

async function readFileSafe() {
    try {
        const data = await fs.readFile(FILEPATH, 'utf-8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

export const setDomain = async (domain: string, port: number, projectId?: string) => {
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
    const data = await readFileSafe();
    if (data[domain]) return data[domain];

    try {
        const record = await prisma.domain.findUnique({ where: { domain } });
        if (record?.port) return record.port;
    } catch {}

    return null;
};