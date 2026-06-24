import { useAuth } from '../context/AuthContext';

const Home = () => {
    const { login, user } = useAuth();

    return (
        <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center px-6 py-20 relative overflow-hidden">
            <div className="max-w-4xl w-full text-center z-10 flex flex-col items-center gap-8">
                <h1 className="text-5xl md:text-7xl font-extrabold text-white">
                    Deploy applications in seconds.
                </h1>
                <p className="max-w-2xl text-neutral-400 text-lg md:text-xl font-light leading-relaxed">
                    Launchly is a lightweight, automated deployment engine
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                    {user ? (
                        <a
                            href="/dashboard"
                            className="px-8 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200"
                        >
                            Go to Dashboard
                        </a>
                    ) : (
                        <button
                            onClick={login}
                            className="px-8 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-all shadow-lg hover:scale-105 duration-200 flex items-center justify-center gap-2"
                        >
                            Get Started with GitHub
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Home;
