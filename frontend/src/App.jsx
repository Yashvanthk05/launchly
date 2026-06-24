import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './context/ProtectedRoute';
import Deploy from './pages/Deploy';
import Deployments from './pages/Deployments';

function App() {
    return (
        <Router>
            <div className="min-h-screen bg-black text-white pt-16">
                <Navbar />
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route element={<ProtectedRoute />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/deploy" element={<Deploy />} />
                        <Route path="/deployments" element={<Deployments />} />
                    </Route>
                </Routes>
            </div>
        </Router>
    );
}

export default App;
