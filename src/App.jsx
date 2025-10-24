// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import AuthProvider, { useAuth } from './context/AuthContext';

// --- Page Imports ---
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
// import MapViewPage from './pages/MapView'; // This was likely the old 'page.jsx', renaming/removing
import SimpleMapView from './pages/MapView'; // Renamed import for clarity (specific session view)
import ManageUsersPage from './pages/ManageUser';
import DriveTestSessionsPage from './pages/DriveTestSessions';
import AppLayout from './components/layout/AppLayout';
import UploadDataPage from './pages/UploadData';
import SettingsPage from './pages/Setting';
import UnifiedMapView from './pages/UnifiedMapView';

// import ManageSessionPage from './pages/ManageSession'; // This seems redundant with DriveTestSessionsPage
// import MapView from './pages/page'; // Deprecated
// import AllLogsMapPage from './pages/AllMaplogpage'; // This might be integrated into HighPerfMap or kept separate
import HighPerfMap from "@/pages/HighPerfMap"; // The main map view with filters/drawing
import LogsCirclesPage from "@/pages/LogsCirclesPage"; // Separate example page
import ProjectsPage from './pages/Projects'; // Renamed import
import PredictionMapPage from './pages/PredictionMap';
import GetReportPage from './pages/GetReport'; // Renamed import

// --- Route Components ---
const PrivateRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated()) {
        return <Navigate to="/" replace />;
    }
    // Pass children directly to AppLayout
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

function App() {
    return (
        <Router>
            <AuthProvider>
                <ToastContainer position="top-right" autoClose={3000} theme="colored" />
                <Routes>
                    <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />

                    {/* Private Routes - Wrap content with PrivateRoute */}
                    <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
                    <Route path="/drive-test-sessions" element={<PrivateRoute><DriveTestSessionsPage /></PrivateRoute>} />
                    {/* Main Map view with Filters & Drawing */}
                    <Route path="/mapview" element={<PrivateRoute><HighPerfMap /></PrivateRoute>} />
                     {/* Map view for specific session(s) from URL */}
                    <Route path="/map" element={<PrivateRoute><SimpleMapView /></PrivateRoute>} />
                    <Route path="/manage-users" element={<PrivateRoute><ManageUsersPage /></PrivateRoute>} />
                    <Route path="/upload-data" element={<PrivateRoute><UploadDataPage /></PrivateRoute>} />
                    <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
                    {/* <Route path="/manage-session" element={<PrivateRoute><ManageSessionPage /></PrivateRoute>} /> */}
                    {/* <Route path="/alllogs" element={<PrivateRoute><AllLogsMapPage /></PrivateRoute>} /> */}
                    <Route path="/logscircles" element={<PrivateRoute><LogsCirclesPage /></PrivateRoute>} />
                    <Route path="/create-project" element={<PrivateRoute><ProjectsPage /></PrivateRoute>} />
                    <Route path="/prediction-map" element={<PrivateRoute><PredictionMapPage /></PrivateRoute>} />
                    <Route path="/getreport" element={<PrivateRoute><GetReportPage /></PrivateRoute>} />
                    <Route path="/unified-map" element={<PrivateRoute><UnifiedMapView /></PrivateRoute>} />
                    

                    {/* Catch-all for Not Found */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;