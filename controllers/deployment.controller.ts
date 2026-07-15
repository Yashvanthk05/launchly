import type { Request, Response } from 'express';
import { deployQ } from '../queue/deployQueue';
import { HttpStatusCode } from 'axios';
import { prisma } from '../utils/db';
import axios from 'axios';

export const createDeployment = async (req: Request, res: Response) => {
    const { userid, reponame, repourl, domain, dockerfileContent } = req.body;

    if (!dockerfileContent?.trim()) {
        return res.status(HttpStatusCode.BadRequest).json({
            status: 'error',
            message: 'Dockerfile content is required.',
        });
    }

    let user = await prisma.user.findUnique({ where: { githubUsername: userid } });
    if (!user) {
        const githubRes = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${req.cookies.deployx_access_token}` },
        });
        const { login, email, name, avatar_url } = githubRes.data;

        user = await prisma.user.findUnique({ where: { email: email || `${login}@github.com` } });
        if (user) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { githubUsername: login, name: name || login, image: avatar_url },
            });
        } else {
            user = await prisma.user.create({
                data: {
                    email: email || `${login}@github.com`,
                    name: name || login,
                    image: avatar_url,
                    githubUsername: login,
                },
            });
        }
    }

    const project = await prisma.project.upsert({
        where: { subDomain: domain },
        update: { name: reponame, repoUrl: repourl, subDomain: domain, userId: user.id },
        create: { name: reponame, repoUrl: repourl, subDomain: domain, userId: user.id },
    });

    const deployment = await prisma.deployment.create({
        data: {
            projectId: project.id,
            status: 'PENDING',
            repoUrl: repourl,
            repoName: reponame,
            domain,
        },
    });

    const job = await deployQ.add('deployxtask', {
        userid,
        reponame,
        repourl,
        domain,
        dockerfileContent,
        deploymentId: deployment.id,
    });

    await prisma.deployment.update({
        where: { id: deployment.id },
        data: { jobId: job.id },
    });

    res.status(HttpStatusCode.Accepted).json({
        status: 'success',
        data: { jobId: job.id, deploymentId: deployment.id },
    });
};

export const getUserDeployments = async (req: Request, res: Response) => {
    const accessToken = req.cookies.deployx_access_token;
    if (!accessToken) {
        return res
            .status(HttpStatusCode.Unauthorized)
            .json({ status: 'error', message: 'Unauthorized' });
    }

    try {
        const githubRes = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const { login, email } = githubRes.data;
        const userEmail = email || `${login}@github.com`;

        let user = await prisma.user.findFirst({
            where: {
                OR: [{ githubUsername: login }, { email: userEmail }],
            },
        });

        if (user) {
            if (!user.githubUsername) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { githubUsername: login },
                });
            }
        } else {
            user = await prisma.user.create({
                data: {
                    email: userEmail,
                    name: login,
                    image: githubRes.data.avatar_url,
                    githubUsername: login,
                },
            });
        }

        const projects = await prisma.project.findMany({
            where: { userId: user.id },
            include: {
                deployments: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        const deployments = projects.flatMap(p =>
            p.deployments.map(d => ({
                ...d,
                projectName: p.name,
                projectSubDomain: p.subDomain,
            }))
        );

        deployments.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return res.json({ status: 'success', data: deployments });
    } catch (error) {
        return res
            .status(HttpStatusCode.InternalServerError)
            .json({ status: 'error', message: 'Failed to fetch deployments' });
    }
};

export const getDeploymentStatus = async (req: Request, res: Response) => {
    const jobId = req.query.jobId as string;
    const deploymentId = req.query.deploymentId as string;

    if (deploymentId) {
        const deployment = await prisma.deployment.findUnique({
            where: { id: deploymentId },
        });
        if (!deployment) {
            return res.status(HttpStatusCode.NotFound).json({
                status: 'error',
                message: 'Deployment not found',
            });
        }
        return res.status(HttpStatusCode.Ok).json({
            status: 'success',
            data: deployment,
        });
    }

    const job = await deployQ.getJob(jobId);

    if (!job) {
        return res.status(HttpStatusCode.NotFound).json({
            status: 'error',
            message: 'Job not found',
        });
    }

    const state = await job.getState();
    const progress = job.progress;
    const result = job.returnvalue;
    const error = job.failedReason;

    res.status(HttpStatusCode.Ok).json({
        status: 'success',
        data: {
            jobId: job.id,
            state,
            progress,
            finishedAt: job.finishedOn,
            createdAt: job.timestamp,
            result,
            error,
        },
    });
};
