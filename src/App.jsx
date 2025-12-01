// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import AuthProvider, { useAuth } from './context/AuthContext';
import { localStorageProvider } from './utils/localStorageProvider';
import Spinner from './components/common/Spinner'; // Ensure Spinner is imported

// --- Page Imports ---
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import SimpleMapView from './pages/MapView';
import ManageUsersPage from './pages/ManageUser';
import DriveTestSessionsPage from './pages/DriveTestSessions';
import AppLayout from './components/layout/AppLayout';
import UploadDataPage from './pages/UploadData';
import SettingsPage from './pages/Setting';
import UnifiedMapView from './pages/UnifiedMapView';
import HighPerfMap from "@/pages/HighPerfMap";
import LogsCirclesPage from "@/pages/LogsCirclesPage";
import ProjectsPage from './pages/Projects';
import PredictionMapPage from './pages/PredictionMap';
import GetReportPage from './pages/GetReport';
import ViewProjectsPage from './pages/ViewProjects';

// --- UPDATED Route Components ---

const PrivateRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth(); // Destructure loading

    if (loading) {
        return <Spinner />; // Wait for auth check to finish
    }

    if (!isAuthenticated()) {
        return <Navigate to="/" replace />;
    }

    return <AppLayout>{children}</AppLayout>;
};

const PublicRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth(); // Destructure loading

    if (loading) {
        return <Spinner />; // Wait for auth check to finish
    }

    return isAuthenticated() ? <Navigate to="/dashboard" replace /> : children;
};

const NotFoundPage = () => (
    <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-4xl font-bold">404 - Not Found</h1>
        <p>The page you are looking for does not exist.</p>
        <Link to="/dashboard" className="mt-4 text-blue-600 hover:underline">Go to Dashboard</Link>
    </div>
);

// ✅ SWR Configuration
const swrConfig = {
    provider: localStorageProvider,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateOnMount: true,
    shouldRetryOnError: true,
    errorRetryCount: 2,
    dedupingInterval: 2000,
    focusThrottleInterval: 5000,
    loadingTimeout: 5000,
    onLoadingSlow: (key) => {
        console.warn(`⏱️ Slow loading detected: ${key}`);
    },
    onError: (error, key) => {
        console.error(`❌ SWR Error [${key}]:`, error?.message || error);
    }
};

function App() {
    return (
        <Router>
            <AuthProvider>
                <SWRConfig value={swrConfig}>
                    <ToastContainer position="top-right" autoClose={3000} theme="colored" />
                    <Routes>
                        <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />

                        {/* Private Routes */}
                        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
                        <Route path="/drive-test-sessions" element={<PrivateRoute><DriveTestSessionsPage /></PrivateRoute>} />
                        <Route path="/mapview" element={<PrivateRoute><HighPerfMap /></PrivateRoute>} />
                        <Route path="/map" element={<PrivateRoute><SimpleMapView /></PrivateRoute>} />
                        <Route path="/manage-users" element={<PrivateRoute><ManageUsersPage /></PrivateRoute>} />
                        <Route path="/upload-data" element={<PrivateRoute><UploadDataPage /></PrivateRoute>} />
                        <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
                        <Route path="/logscircles" element={<PrivateRoute><LogsCirclesPage /></PrivateRoute>} />
                        <Route path="/create-project" element={<PrivateRoute><ProjectsPage /></PrivateRoute>} />
                        <Route path="/prediction-map" element={<PrivateRoute><PredictionMapPage /></PrivateRoute>} />
                        <Route path="/getreport" element={<PrivateRoute><GetReportPage /></PrivateRoute>} />
                        <Route path="/unified-map" element={<PrivateRoute><UnifiedMapView /></PrivateRoute>} />
                        <Route path="/viewProject" element={<PrivateRoute><ViewProjectsPage/></PrivateRoute>} />

                        {/* Catch-all for Not Found */}
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                </SWRConfig>
            </AuthProvider>
        </Router>
    );
}

export default App;