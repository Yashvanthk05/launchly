import { Worker, type Job } from 'bullmq';
import { redis } from '../config/redis';
import { deployQueueName } from './deployQueue';
import { logger } from '../config/logger';
import path from 'node:path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getFreePort } from '../utils/port';
import { generateDockerfile } from '../utils/docker';
import fs from 'node:fs/promises';
import { setDomain } from '../utils/domainStore';
import { prisma } from '../utils/db';

const execasync = promisify(exec);

interface DeployJobData {
    userid: string;
    repourl: string;
    reponame: string;
    framework: string;
    domain: string;
    startCommand: string;
    buildCommand: string;
    rootDir: string;
    deploymentId?: string;
}

const processor = async (job: Job<DeployJobData>) => {
    const { userid, reponame, repourl, framework, domain, buildCommand, startCommand, rootDir, deploymentId } =
        job.data;

    logger.info(
        { userid, repourl, framework, domain, buildCommand, startCommand, rootDir },
        'deploy worker started'
    );

    const projectpath = path.join('./tmp/deployx/', `${userid}/${reponame}`);
    const buildpath = path.join(projectpath, rootDir);
    const logsPath = `${buildpath}/logs.txt`;
    const fullDomain = `${domain}.launchly.software`;

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

        logger.info('step2: building repo');

        await generateDockerfile(framework, buildpath, buildCommand, startCommand, rootDir);

        const imageTag = `${userid}:${reponame}`;

        await execasync(`docker build -t ${imageTag} ${buildpath} >> "${logsPath}" 2>&1`);

        await job.updateProgress(60);

        const containerName = `${reponame}-${job.id}`;

        const freePort = await getFreePort();

        try {
            await execasync(`docker rm -f ${containerName}`);
        } catch (_e) {}

        await updateDeployment({ status: 'RUNNING', containerName, containerPort: freePort, imageTag, logsPath });

        await execasync(`
        docker run -d -p ${freePort}:3000 --name ${containerName} ${imageTag} >> "${logsPath}" 2>&1
        `);

        logger.info(`Registering ${fullDomain} in router...`);

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
