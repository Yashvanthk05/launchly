import type { Request, Response } from 'express';
import axios from 'axios';

const getUser = async (req: Request, res: Response) => {
    const access_token = req.cookies.deployx_access_token;

    if (!access_token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const response = await axios.get('https://api.github.com/user', {
        headers: {
            Authorization: `Bearer ${access_token}`,
        },
    });

    return res.json(response.data);
};

const getRepos = async (req: Request, res: Response) => {
    const access_token = req.cookies.deployx_access_token;

    if (!access_token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const response = await axios.get('https://api.github.com/user/repos', {
        headers: {
            Authorization: `Bearer ${access_token}`,
        },
    });

    return res.json(response.data);
};
export { getUser, getRepos };
