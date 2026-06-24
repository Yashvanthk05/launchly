import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { ExternalLink, Container, Timer, GitBranch, Loader2, Activity } from 'lucide-react';

const statusColors = {
    PENDING: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    CLONING: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    BUILDING: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    RUNNING: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    COMPLETED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    FAILED: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const statusIcons = {
    PENDING: Timer,
    CLONING: GitBranch,
    BUILDING: Loader2,
    RUNNING: Activity,
    COMPLETED: Container,
    FAILED: Loader2,
};

const Deployments = () => {
    const { user } = useAuth();
    const [deployments, setDeployments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDeployments = async () => {
            try {
                const res = await axios.get('/api/deployment/user-deployments');
                setDeployments(res.data.data);
            } catch (error) {
                console.error('Failed to fetch deployments:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchDeployments();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white px-6 py-12">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Deployments</h1>
                <p className="text-neutral-500 mb-8">
                    All deployments for {user?.name || user?.login}
                </p>

                {deployments.length === 0 ? (
                    <div className="text-center py-20">
                        <Container className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                        <p className="text-neutral-500 text-lg">No deployments yet</p>
                        <p className="text-neutral-600 text-sm mt-1">
                            Deploy a project from the dashboard to get started
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {deployments.map(dep => {
                            const StatusIcon = statusIcons[dep.status] || Timer;
                            const colorClass = statusColors[dep.status] || 'text-neutral-400 bg-neutral-800/30 border-neutral-700/30';

                            return (
                                <div
                                    key={dep.id}
                                    className="border border-neutral-900 bg-neutral-950/40 rounded-2xl p-5 hover:border-neutral-800 transition-colors"
                                >
                                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h2 className="text-lg font-semibold truncate">
                                                    {dep.repoName || dep.projectName}
                                                </h2>
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
                                                    <StatusIcon className={`w-3 h-3 ${dep.status === 'BUILDING' ? 'animate-spin' : ''}`} />
                                                    {dep.status}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-neutral-500">
                                                {dep.domain && (
                                                    <a
                                                        href={`https://${dep.domain}.launchly.software`}
                                                        target="_blank"
                                                        className="flex items-center gap-1.5 hover:text-neutral-300 transition-colors"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                        {dep.domain}.launchly.software
                                                    </a>
                                                )}
                                                <span>{dep.framework}</span>
                                                {dep.containerPort && (
                                                    <span>Port {dep.containerPort}</span>
                                                )}
                                                {dep.jobId && <span>Job #{dep.jobId}</span>}
                                            </div>

                                            {dep.errorMessage && (
                                                <p className="text-red-400 text-sm mt-2 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                                                    {dep.errorMessage}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-end text-xs text-neutral-600 shrink-0">
                                            <span>{new Date(dep.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            <span>{new Date(dep.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                            {dep.finishedAt && (
                                                <span className="mt-1 text-neutral-700">
                                                    Finished {new Date(dep.finishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Deployments;
