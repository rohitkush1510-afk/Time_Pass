import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import CampaignDetail from './pages/CampaignDetail';
import CreateCampaign from './pages/CreateCampaign';
import MyCampaigns from './pages/MyCampaigns';
import MyPledges from './pages/MyPledges';
import AdminDashboard from './pages/AdminDashboard';


function Protected({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="container">Loading...</p>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <p className="container">You are not allowed to see this page.</p>;

  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Navbar />
          <div className="container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/campaign/:id" element={<CampaignDetail />} />
              <Route path="/create" element={<Protected role="creator"><CreateCampaign /></Protected>} />
              <Route path="/my-campaigns" element={<Protected role="creator"><MyCampaigns /></Protected>} />
              <Route path="/my-pledges" element={<Protected><MyPledges /></Protected>} />
              <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}