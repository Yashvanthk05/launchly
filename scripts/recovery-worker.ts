import { prisma } from '../utils/db';
import { redis } from '../config/redis';
import { setDomain } from '../utils/domainStore';
import { execSync } from 'node:child_process';
import { createServer } from 'node:net';
import { logger } from '../config/logger';

const PORT_MIN = 3000;
const PORT_MAX = 9000;

function exec(cmd: string): string {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
}

function execSafe(cmd: string): string {
    try {
        return exec(cmd);
    } catch {
        return '';
    }
}

async function findFreePort(preferred: number | null, usedPorts: Set<number>): Promise<number> {
    const tryPorts = preferred ? [preferred, ...range(PORT_MIN, PORT_MAX)] : range(PORT_MIN, PORT_MAX);
    for (const port of tryPorts) {
        if (usedPorts.has(port)) continue;
        const busy = await isPortInUse(port);
        if (!busy) return port;
    }
    throw new Error(`No free port found in range ${PORT_MIN}-${PORT_MAX}`);
}

function* range(start: number, end: number): Iterable<number> {
    for (let i = start; i <= end; i++) yield i;
}

function isPortInUse(port: number): Promise<boolean> {
    return new Promise(resolve => {
        const server = createServer();
        server.once('error', () => resolve(true));
        server.once('listening', () => {
            server.close();
            resolve(false);
        });
        server.listen(port, '0.0.0.0');
    });
}

interface ContainerInfo {
    id: string;
    name: string;
    ports: string;
    status: string;
}

function listDockerContainers(all = false): ContainerInfo[] {
    const flag = all ? '-a' : '';
    const out = execSafe(`docker ps ${flag} --format '{{.ID}}\t{{.Names}}\t{{.Ports}}\t{{.Status}}'`);
    if (!out) return [];
    return out.split('\n').filter(Boolean).map(line => {
        const parts = line.split('\t');
        return { id: parts[0] || '', name: parts[1] || '', ports: parts[2] || '', status: parts[3] || '' };
    });
}

function getContainerHostPort(container: ContainerInfo): number | null {
    const m = container.ports.match(/(\d+)->3000/);
    return m && m[1] ? parseInt(m[1], 10) : null;
}

async function getUsedPortsFromRedis(): Promise<Set<number>> {
    const keys = await redis.keys('domain:*');
    const ports = new Set<number>();
    for (const key of keys) {
        const val = await redis.get(key);
        if (val) ports.add(Number(val));
    }
    return ports;
}

async function getUsedPortsFromDocker(): Promise<Set<number>> {
    const ports = new Set<number>();
    for (const c of listDockerContainers(true)) {
        const p = getContainerHostPort(c);
        if (p) ports.add(p);
    }
    return ports;
}

async function recover() {
    logger.info('Recovery worker started');

    const deployments = await prisma.deployment.findMany({
        where: { status: 'RUNNING' },
    });

    logger.info({ count: deployments.length }, 'Found RUNNING deployments');

    const usedPorts = new Set([
        ...Array.from(await getUsedPortsFromRedis()),
        ...Array.from(await getUsedPortsFromDocker()),
    ]);

    const allContainers = listDockerContainers(true);
    const containerByName = new Map(allContainers.map(c => [c.name, c]));

    for (const dep of deployments) {
        if (!dep.containerName || !dep.imageTag || !dep.domain) {
            logger.warn({ deploymentId: dep.id }, 'Skipping incomplete deployment');
            continue;
        }

        const fullDomain = `${dep.domain}.launchly.software`;

        try {
            const existing = containerByName.get(dep.containerName);

            if (existing && existing.status.startsWith('Up')) {
                const hostPort = getContainerHostPort(existing) || dep.containerPort;
                logger.info({ container: dep.containerName, port: hostPort }, 'Container already running');
                if (hostPort) {
                    usedPorts.add(hostPort);
                    await setDomain(fullDomain, hostPort, dep.projectId);
                    if (dep.containerPort !== hostPort) {
                        await prisma.deployment.update({
                            where: { id: dep.id },
                            data: { containerPort: hostPort },
                        });
                    }
                }
                continue;
            }

            if (existing && existing.status.startsWith('Exited')) {
                logger.info({ container: dep.containerName }, 'Restarting exited container');
                execSafe(`docker start ${dep.containerName}`);
                const hostPort = getContainerHostPort(existing) || dep.containerPort;
                if (hostPort) {
                    usedPorts.add(hostPort);
                    await setDomain(fullDomain, hostPort, dep.projectId);
                    if (dep.containerPort !== hostPort) {
                        await prisma.deployment.update({
                            where: { id: dep.id },
                            data: { containerPort: hostPort },
                        });
                    }
                }
                continue;
            }

            const port = await findFreePort(dep.containerPort ?? null, usedPorts);
            usedPorts.add(port);

            execSafe(`docker rm -f ${dep.containerName}`);

            const cmd = `docker run -d --name ${dep.containerName} --label deployx.managed=true -p ${port}:3000 ${dep.imageTag}`;
            logger.info({ cmd }, 'Creating container');
            exec(cmd);

            await setDomain(fullDomain, port, dep.projectId);
            await prisma.deployment.update({
                where: { id: dep.id },
                data: { containerPort: port },
            });

            logger.info({ container: dep.containerName, port, domain: fullDomain }, 'Container created');
        } catch (err) {
            logger.error({ deploymentId: dep.id, error: (err as Error).message }, 'Failed to recover deployment');
        }
    }

    const managedNames = new Set(deployments.map(d => d.containerName).filter(Boolean));
    const labeledContainers = execSafe(`docker ps -a --filter label=deployx.managed=true --format '{{.Names}}'`)
        .split('\n').filter(Boolean);
    for (const name of labeledContainers) {
        if (!managedNames.has(name)) {
            logger.info({ container: name }, 'Removing orphan container');
            execSafe(`docker rm -f ${name}`);
        }
    }

    logger.info('Recovery complete');
}

recover()
    .catch(err => {
        logger.error({ error: (err as Error).message }, 'Recovery failed');
        process.exit(1);
    })
    .finally(async () => {
        await redis.quit();
        await prisma.$disconnect();
    });
