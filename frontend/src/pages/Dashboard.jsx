import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const { user } = useAuth();
    const [repos, setRepos] = useState([]);
    const [deployments, setDeployments] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchRepos = async () => {
            const res = await axios.get('/api/github/repos');
            setRepos(res.data);
        };
        fetchRepos();
    }, [user]);

    useEffect(() => {
        const fetchDeployments = async () => {
            try {
                const res = await axios.get('/api/deployment/user-deployments');
                setDeployments(res.data.data || []);
            } catch (error) {
                console.error('Failed to fetch deployments:', error);
            }
        };
        fetchDeployments();
    }, []);

    const activeServices = deployments.filter(
        d => d.status === 'RUNNING' || d.status === 'COMPLETED'
    ).length;
    const totalDeployments = deployments.length;

    const handleDeploy = repo => {
        navigate('/deploy', { state: repo });
    };

    return (
        <div className="min-h-screen bg-black text-white px-6 py-12 relative overflow-hidden">
            <div className="max-w-6xl mx-auto flex flex-col gap-8 relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Welcome back, {user?.name || user?.login}
                        </h1>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                    <div className="p-6 rounded-2xl border border-neutral-900 bg-neutral-950/40">
                        <div className="text-neutral-500 text-xs uppercase font-semibold tracking-wider">
                            Active Services
                        </div>
                        <div className="text-4xl font-extrabold mt-2 text-white">
                            {activeServices}
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl border border-neutral-900 bg-neutral-950/40">
                        <div className="text-neutral-500 text-xs uppercase font-semibold tracking-wider">
                            Total Deployments
                        </div>
                        <div className="text-4xl font-extrabold mt-2 text-white">
                            {totalDeployments}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-6 items-center justify-center">
                    {repos.map(repo => (
                        <div
                            key={repo.id}
                            className="group w-[340px] bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between"
                        >
                            <div className="flex flex-col gap-3">
                                <h2 className="text-lg font-semibold text-white truncate">
                                    {repo.name}
                                </h2>
                            </div>

                            <div className="mt-5 flex items-center justify-between">
                                <a href={repo.html_url} target="_blank" className="text-white">
                                    View Repo
                                </a>

                                <button
                                    onClick={() => handleDeploy(repo)}
                                    className="bg-neutral-900 text-white text-sm font-medium px-4 py-1.5 rounded-lg cursor-pointer hover:bg-neutral-800"
                                >
                                    Deploy
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
