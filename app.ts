import express from 'express';
import helmet from 'helmet';
import authRouter from './routes/auth.route';
import githubRouter from './routes/github.routes';
import deploymentRouter from './routes/deployment.routes';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import httpProxy from 'http-proxy';
import { getDomain } from './utils/domainStore';
import { logger } from './config/logger';
import path from 'path';
import net from 'node:net';

const app = express();

const proxy = httpProxy.createProxyServer({
    ws: true,
    changeOrigin: true,
});

const badGatewayPage = path.join(process.cwd(), 'templates/badgateway.html');

const isPortReachable = async (port: number) => {
    return new Promise<boolean>(resolve => {
        const socket = net.createConnection({ host: '127.0.0.1', port });

        const finish = (reachable: boolean) => {
            socket.removeAllListeners();
            socket.destroy();
            resolve(reachable);
        };

        socket.setTimeout(500);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));
    });
};

proxy.on('error', (err, req, res) => {
    logger.error({ err, host: req.headers.host }, 'Proxy Error');
    if (res && 'writeHead' in res) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(
            'Bad Gateway: Container might be restarting or redeploying. Check back in a moment.'
        );
    }
});

app.use(async (req, res, next) => {
    try {
        const hostname = req.headers.host || '';
        const port = await getDomain(hostname.split(':')[0] || '');
        if (port) {
            const reachable = await isPortReachable(port);
            if (!reachable) {
                logger.warn({ host: hostname, port }, 'Stale domain mapping');
                return res.status(502).sendFile(badGatewayPage);
            }

            return proxy.web(req, res, { target: `http://localhost:${port}` });
        }
        next();
    } catch (error) {
        logger.error({ error }, 'proxy error');
        res.status(500).send('Internal Server Error');
    }
});

app.use(helmet());
app.use(cors());

app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRouter);
app.use('/api/github', githubRouter);
app.use('/api/deployment', deploymentRouter);

app.use(express.static(path.join(process.cwd(), 'frontend/dist')));

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(process.cwd(), 'frontend/dist/index.html'));
});

export default app;
