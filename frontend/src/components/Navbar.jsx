import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LogOut, Container } from 'lucide-react';

const Navbar = () => {
    const { login, logout, user } = useAuth();

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-md border-b border-neutral-900">
            <div className="max-w-6xl mx-auto px-6 h-16 flex justify-between items-center">
                <div className="flex items-center gap-8">
                    <Link
                        to="/"
                        className="flex items-center gap-2 text-white hover:text-neutral-300"
                    >
                        <span className="text-xl font-bold tracking-tight">Launchly</span>
                    </Link>
                    {user && (
                        <div className="flex items-center gap-4">
                            <Link
                                to="/dashboard"
                                className="text-sm text-neutral-400 hover:text-white transition-colors"
                            >
                                Dashboard
                            </Link>
                            <Link
                                to="/deployments"
                                className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
                            >
                                <Container className="w-4 h-4" />
                                Deployments
                            </Link>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {user ? (
                        <>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl">
                                    <span className="text-sm font-semibold text-neutral-200">
                                        {user.name || user.login}
                                    </span>
                                </div>
                                <button
                                    onClick={logout}
                                    className="cursor-pointer text-white hover:text-neutral-400 transition-colors"
                                    title="Logout"
                                >
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <button
                            className="bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-neutral-800 transition-colors"
                            onClick={login}
                        >
                            Login
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Navbar;
