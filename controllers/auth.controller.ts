import axios from 'axios';
import { env } from '../config/env';
import type { Request, Response } from 'express';
import { prisma } from '../utils/db';

const redirectGithubLogin = (req: Request, res: Response) => {
    const params = new URLSearchParams();
    params.append('client_id', env.GITHUB_CLIENT);
    params.append('redirect_uri', env.GITHUB_REDIRECT_URL);
    params.append('scope', 'read:user read:repo');
    params.append('state', env.CSRF_SECRET!);

    const url = `https://github.com/login/oauth/authorize?${params.toString()}`;

    res.redirect(url);
};

const getGitHubUser = async (accessToken: string) => {
    const res = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
};

const githubCallback = async (req: Request, res: Response) => {
    const code = req.query.code;
    const state = req.query.state;

    if (!code) {
        return res.redirect(`/login`);
    }

    if (state !== env.CSRF_SECRET) {
        return res.redirect('/login');
    }

    const params = new URLSearchParams();
    params.append('client_id', env.GITHUB_CLIENT);
    params.append('client_secret', env.GITHUB_SECRET);
    params.append('code', code as string);
    params.append('redirect_uri', env.GITHUB_REDIRECT_URL);

    const url = `https://github.com/login/oauth/access_token?${params}`;

    const response = await axios.post(url, null, {
        headers: {
            Accept: 'application/json',
        },
    });

    const { access_token } = response.data;

    if (!access_token) {
        return res.redirect('/login');
    }

    const githubUser = await getGitHubUser(access_token);
    const { login, email, name, avatar_url } = githubUser;

    const userEmail = email || `${login}@github.com`;

    const user = await prisma.user.upsert({
        where: { email: userEmail },
        update: { name: name || login, image: avatar_url, githubUsername: login },
        create: {
            email: userEmail,
            name: name || login,
            image: avatar_url,
            githubUsername: login,
        },
    });

    res.cookie('deployx_access_token', access_token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 1000,
    });

    const redirectUrl =
        env.NODE_ENV === 'production' ? '/dashboard' : 'http://localhost:5173/dashboard';
    return res.redirect(redirectUrl);
};

const logout = (req: Request, res: Response) => {
    res.clearCookie('deployx_access_token');
    return res.status(200).json({ success: true });
};

export { redirectGithubLogin, githubCallback, logout };
