import { Worker, type Job } from 'bullmq';
import { redis } from '../config/redis';
import { deployQueueName } from './deployQueue';
import { logger } from '../config/logger';
import path from 'node:path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getFreePort } from '../utils/port';
import { writeDockerfile } from '../utils/docker';
import fs from 'node:fs/promises';
import { setDomain } from '../utils/domainStore';
import { prisma } from '../utils/db';

const execasync = promisify(exec);

interface DeployJobData {
    userid: string;
    repourl: string;
    reponame: string;
    domain: string;
    dockerfileContent: string;
    deploymentId?: string;
}

const processor = async (job: Job<DeployJobData>) => {
    const { userid, reponame, repourl, domain, dockerfileContent, deploymentId } = job.data;

    logger.info({ userid, repourl, domain }, 'deploy worker started');

    const projectpath = path.join('./tmp/deployx/', `${userid}/${reponame}`);
    const fullDomain = domain;
    const exposedPortMatch = dockerfileContent.match(/^\s*EXPOSE\s+(\d+)/im);
    const containerPort = Number.parseInt(exposedPortMatch?.[1] || '3000', 10) || 3000;

    const updateDeployment = (data: Record<string, unknown>) => {
        if (deploymentId) {
            return prisma.deployment.update({ where: { id: deploymentId }, data }).catch(e => {
                logger.error({ error: e }, 'Failed to update deployment in DB');
            });
        }
        return Promise.resolve();
    };

    try {
        logger.info('step1: cloning repo');
        await updateDeployment({ status: 'CLONING' });

        await fs.rm(projectpath, { recursive: true, force: true });
        await execasync(`git clone ${repourl} "${projectpath}"`);

        await job.updateProgress(20);
        await updateDeployment({ status: 'BUILDING' });

        logger.info('step2: building image');

        await writeDockerfile(projectpath, dockerfileContent);

        const imageTag = `${userid}:${reponame}`;

        await execasync(`docker build -t ${imageTag} ${projectpath} >> "${projectpath}/logs.txt" 2>&1`);

        await job.updateProgress(60);

        const containerName = `${reponame}-${job.id}`;
        const freePort = await getFreePort();

        try {
            await execasync(`docker rm -f ${containerName}`);
        } catch (_e) {}

        await updateDeployment({ status: 'RUNNING', containerName, containerPort: freePort, imageTag });

        await execasync(`docker run -d -p ${freePort}:${containerPort} --name ${containerName} ${imageTag} >> "${projectpath}/logs.txt" 2>&1`);

        const dep = deploymentId
            ? await prisma.deployment.findUnique({ where: { id: deploymentId }, select: { projectId: true } })
            : null;
        await setDomain(fullDomain, freePort, dep?.projectId);

        logger.info(`Successfully mapped ${fullDomain} to port ${freePort}`);

        await job.updateProgress(100);
        await updateDeployment({ status: 'COMPLETED', finishedAt: new Date() });

        logger.info({ jobId: job.id, port: freePort }, 'Deployment completed');
    } catch (err) {
        const errorMessage = (err as Error).message;
        logger.error({ error: errorMessage }, 'Deployment failed');
        await updateDeployment({ status: 'FAILED', errorMessage, finishedAt: new Date() });
        throw err;
    }
};

export const createWorker = () => {
    const worker = new Worker(deployQueueName, processor, {
        connection: redis as any,
        concurrency: 5,
    });

    worker.on('completed', job => {
        logger.info(`job ${job.id} completed`);
    });

    worker.on('error', err => {
        logger.error(`worker error: ${err}`);
    });
};
