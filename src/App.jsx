import React from 'react'; // Removed useEffect as it's no longer needed here
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import AuthProvider, { useAuth } from './context/AuthContext';


// --- Page Imports ---
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import MapViewPage from './pages/MapView';
import ManageUsersPage from './pages/ManageUser';
import DriveTestSessionsPage from './pages/DriveTestSessions';
import AppLayout from './components/layout/AppLayout';
import UploadDataPage from './pages/UploadData';
import SettingsPage from './pages/Setting';
import ManageSessionPage from './pages/ManageSession';
import MapView from './pages/page';
import AllLogsMapPage from './pages/AllMaplogpage';
import HighPerfMap from "@/pages/HighPerfMap";
import LogsCirclesPage from "@/pages/LogsCirclesPage";

// --- Route Components (Unchanged) ---
const PrivateRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated()) {
        return <Navigate to="/" replace />;
    }
    return <AppLayout>{children}</AppLayout>;
};

const PublicRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();
    return isAuthenticated() ? <Navigate to="/dashboard" replace /> : children;
};

const NotFoundPage = () => (
    <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-4xl font-bold">404 - Not Found</h1>
        <p>The page you are looking for does not exist.</p>
        <Link to="/dashboard" className="mt-4 text-blue-600 hover:underline">Go to Dashboard</Link>
    </div>
);

// A new component to make the ToastContainer theme-aware
// const ThemedToastContainer = () => {
//     const { theme } = useTheme();
//     return (
//         <ToastContainer
//             position="top-right"
//             autoClose={3000}
//             // The theme now dynamically updates when the context changes
//             theme={theme === 'system' 
//                 ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') 
//                 : theme
//             }
//         />
//     );
// };

function App() {
    // The old useEffect for theme has been removed. The ThemeProvider now handles everything.
    return (
        <Router>
            <AuthProvider>
                {/* Wrap the entire app in the ThemeProvider */}
                
                    
                    <Routes>
                        <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
                        
                        {/* Private Routes */}
                        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
                        <Route path="/drive-test-sessions" element={<PrivateRoute><DriveTestSessionsPage /></PrivateRoute>} />
                        <Route path="/map-view" element={<PrivateRoute><MapViewPage /></PrivateRoute>} />
                        <Route path="/manage-users" element={<PrivateRoute><ManageUsersPage /></PrivateRoute>} />
                        <Route path="/upload-data" element={<PrivateRoute><UploadDataPage /></PrivateRoute>} />
                        <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
                        <Route path="/manage-session" element={<PrivateRoute><ManageSessionPage /></PrivateRoute>} />
                        {/* <Route path="/map" element={<PrivateRoute><MapView /></PrivateRoute>} /> */}
                        <Route path="/alllogs" element={<PrivateRoute><AllLogsMapPage /></PrivateRoute>} />
                        <Route path="/mapview" element={<PrivateRoute><HighPerfMap /></PrivateRoute>} />
                        <Route path="/logscircles" element={<PrivateRoute><LogsCirclesPage /></PrivateRoute>} />
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                
            </AuthProvider>
        </Router>
    );
}

export default App;
