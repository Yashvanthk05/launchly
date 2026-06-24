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
        framework: '',
        buildCommand: '',
        startCommand: '',
        rootDir: '',
    });

    const [deploying, setDeploying] = useState(false);

    const handleDeploy = async () => {
        setDeploying(true);
        try {
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
                    Configure your deployment settings for{' '}
                    <span className="font-semibold text-white">{repo?.name}</span>.
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
                            .deployx.me
                        </span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Framework Preset
                    </label>
                    <select
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 outline-none cursor-pointer text-white"
                        value={deploy.framework}
                        onChange={e => setDeploy({ ...deploy, framework: e.target.value })}
                    >
                        <option value="" selected disabled>
                            Select a framework
                        </option>
                        <option value="next">Next.js</option>
                        <option value="react">React</option>
                        <option value="vite">Vite + React</option>
                        <option value="express">Express</option>
                        <option value="python">Python</option>
                    </select>
                </div>

                <div className="pt-4 border-t border-neutral-800 space-y-4">
                    <h3 className="text-lg font-medium">Build and Output Settings</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-neutral-400 mb-1">
                                Build Command
                            </label>
                            <input
                                type="text"
                                placeholder="npm run build"
                                value={deploy.buildCommand}
                                onChange={e =>
                                    setDeploy({ ...deploy, buildCommand: e.target.value })
                                }
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-neutral-400 mb-1">
                                Start Command
                            </label>
                            <input
                                type="text"
                                placeholder="npm start"
                                value={deploy.startCommand}
                                onChange={e =>
                                    setDeploy({ ...deploy, startCommand: e.target.value })
                                }
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 outline-none"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm text-neutral-400 mb-1">
                                Root Directory
                            </label>
                            <input
                                type="text"
                                placeholder="./"
                                value={deploy.rootDir}
                                onChange={e => setDeploy({ ...deploy, rootDir: e.target.value })}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 outline-none"
                            />
                        </div>
                    </div>
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
