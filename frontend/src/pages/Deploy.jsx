import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Deploy = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const repo = location.state;
    const { user } = useAuth();

    const [deploy, setDeploy] = useState({
        userid: user?.login.toLowerCase(),
        reponame: repo?.name.toLowerCase(),
        repourl: repo?.html_url,
        domain: repo?.name.toLowerCase(),
        dockerfileContent: '',
    });

    const [deploying, setDeploying] = useState(false);

    const handleDeploy = async () => {
        setDeploying(true);
        try {
            if (!deploy.dockerfileContent.trim()) {
                throw new Error('Please enter your Dockerfile.');
            }
            const res = await axios.post('/api/deployment/create', deploy);
            if (res.status === 202) {
                navigate('/deployments');
            }
        } catch (error) {
            console.error('Deployment failed:', error);
        } finally {
            setDeploying(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center py-8 px-4">
            <div className="w-full max-w-2xl mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Deploy your project</h1>
                <p className="text-neutral-400">
                    Write your Dockerfile for{' '}
                    <span className="font-semibold text-white">{repo?.name}</span> and deploy.
                </p>
            </div>

            <div className="w-full max-w-2xl space-y-6">
                <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Project Domain
                    </label>
                    <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg w-full">
                        <input
                            type="text"
                            placeholder="projectname"
                            value={deploy.domain}
                            onChange={e => setDeploy({ ...deploy, domain: e.target.value })}
                            className="flex-1 w-0 bg-transparent px-4 py-3 outline-none text-white placeholder-neutral-600"
                        />
                        <span className="px-4 text-neutral-500 font-mono bg-neutral-900 border-l border-neutral-800 py-3 select-none">
                            .launchly.software
                        </span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Dockerfile
                    </label>
                    <textarea
                        placeholder={`FROM node:18-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nEXPOSE 3000\nCMD ["npm", "start"]`}
                        value={deploy.dockerfileContent}
                        onChange={e => setDeploy({ ...deploy, dockerfileContent: e.target.value })}
                        rows={16}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 outline-none font-mono text-sm leading-6"
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                        Write your Dockerfile exactly as you want it built. The EXPOSE port is used to map traffic.
                    </p>
                </div>

                <div className="pt-6">
                    <button
                        onClick={handleDeploy}
                        disabled={deploying}
                        className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 hover:bg-neutral-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {deploying ? 'Deploying...' : 'Deploy Application'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Deploy;
