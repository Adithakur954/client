// src/App.jsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
} from "react-router-dom";
import { SWRConfig } from "swr";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import AuthProvider, { useAuth } from "./context/AuthContext";
import { localStorageProvider } from "./utils/localStorageProvider";
import Spinner from "./components/common/Spinner";

// --- Page Imports ---
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import SimpleMapView from "./pages/MapView";
import ManageUsersPage from "./pages/ManageUser";
import DriveTestSessionsPage from "./pages/DriveTestSessions";
import AppLayout from "./components/layout/AppLayout";
import UploadDataPage from "./pages/UploadData";
import SettingsPage from "./pages/Setting";
import UnifiedMapView from "./pages/UnifiedMapView";
import HighPerfMap from "@/pages/HighPerfMap";
import LogsCirclesPage from "@/pages/LogsCirclesPage";
import ProjectsPage from "./pages/Projects";
import PredictionMapPage from "./pages/PredictionMap";
import GetReportPage from "./pages/GetReport";
import ViewProjectsPage from "./pages/ViewProjects";

// ============================================
// ROUTE COMPONENTS
// ============================================
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Spinner />;
  }

  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Spinner />;
  }

  return isAuthenticated() ? <Navigate to="/dashboard" replace /> : children;
};

const NotFoundPage = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <div className="text-center p-8 bg-white rounded-xl shadow-lg">
      <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-700 mb-2">
        Page Not Found
      </h2>
      <p className="text-gray-600 mb-6">
        The page you are looking for does not exist.
      </p>
      <Link
        to="/dashboard"
        className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        Go to Dashboard
      </Link>
    </div>
  </div>
);

// ============================================
// SWR CONFIGURATION
// ============================================
const swrConfig = {
  provider: localStorageProvider,

  // Revalidation settings
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  revalidateOnMount: true,
  revalidateIfStale: true,

  // Error handling
  shouldRetryOnError: true,
  errorRetryCount: 2,
  errorRetryInterval: 3000,

  // Performance settings
  dedupingInterval: 5000,
  focusThrottleInterval: 30000,
  loadingTimeout: 10000,

  // Keep previous data while revalidating
  keepPreviousData: true,

  // Callbacks
  onLoadingSlow: (key, config) => {
    console.warn(`⏱️ Slow loading detected: ${key}`);
    console.log("Config:", config);
  },

  onSuccess: (data, key, config) => {
    // ✅ Debug logging for specific keys (especially handset data)
    if (key === "handsetAvg") {
      console.group(`✅ SWR Success [${key}]`);
      console.log("Data type:", typeof data);
      console.log("Is array:", Array.isArray(data));
      console.log("Data keys:", data ? Object.keys(data) : "null");
      console.log("Data length:", data?.length);
      console.log("Full data:", data);
      console.groupEnd();
    }

    // Log other important data fetches
    if (
      key.includes("handset") ||
      key.includes("totals") ||
      key.includes("operators")
    ) {
      console.log(`✅ [${key}] loaded successfully`, {
        type: typeof data,
        length: Array.isArray(data) ? data.length : undefined,
        keys:
          typeof data === "object" && data !== null
            ? Object.keys(data)
            : undefined,
      });
    }
  },

  onError: (error, key, config) => {
    // ✅ Improved error logging with more details
    console.group(`❌ SWR Error [${key}]`);
    console.error("Error object:", error);
    console.error("Error message:", error?.message);
    console.error("Error name:", error?.name);
    console.error("Error response:", error?.response);
    console.error("Error response data:", error?.response?.data);
    console.error("Error response status:", error?.response?.status);
    console.groupEnd();

    // Handle specific error types
    if (
      error?.message?.includes("Network Error") ||
      error?.message?.includes("timeout") ||
      error?.name === "AbortError"
    ) {
      console.warn(`🌐 Network connectivity issue for [${key}]`);
    } else if (error?.response?.status === 401) {
      console.error("🔒 Authentication required");
      // Optionally redirect to login
    } else if (error?.response?.status === 403) {
      console.error("🚫 Access forbidden");
    } else if (error?.response?.status === 404) {
      console.warn(`📭 Resource not found: ${key}`);
    } else if (error?.response?.status >= 500) {
      console.error("🔥 Server error");
    }
  },

  onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
    // ✅ Custom retry logic
    console.log(
      `🔄 Retrying [${key}] (attempt ${retryCount + 1}/${
        config.errorRetryCount
      })`
    );

    // Don't retry on 404
    if (error?.response?.status === 404) {
      console.log("❌ Not retrying 404 error");
      return;
    }

    // Don't retry on 401/403
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      console.log("❌ Not retrying auth error");
      return;
    }

    // Max retries reached
    if (retryCount >= config.errorRetryCount) {
      console.log("❌ Max retries reached");
      return;
    }

    // Exponential backoff
    const timeout = Math.min(1000 * Math.pow(2, retryCount), 10000);
    console.log(`⏳ Waiting ${timeout}ms before retry`);

    setTimeout(() => {
      revalidate({ retryCount });
    }, timeout);
  },

  // Compare function for data equality (prevents unnecessary re-renders)
  compare: (a, b) => {
    // For arrays, check length and first item
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      if (a.length === 0 && b.length === 0) return true;
      // Simple shallow comparison for performance
      return JSON.stringify(a[0]) === JSON.stringify(b[0]);
    }

    // For objects, shallow comparison
    if (
      typeof a === "object" &&
      typeof b === "object" &&
      a !== null &&
      b !== null
    ) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key) => a[key] === b[key]);
    }

    // Default comparison
    return a === b;
  },
};

// ============================================
// MAIN APP COMPONENT
// ============================================
function App() {
  return (
    <Router>
      <AuthProvider>
        <SWRConfig value={swrConfig}>
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={true}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="colored"
          />

          <Routes>
            {/* Public Route */}
            <Route
              path="/"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />

            {/* Private Routes */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <DashboardPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/drive-test-sessions"
              element={
                <PrivateRoute>
                  <DriveTestSessionsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/mapview"
              element={
                <PrivateRoute>
                  <HighPerfMap />
                </PrivateRoute>
              }
            />
            <Route
              path="/map"
              element={
                <PrivateRoute>
                  <SimpleMapView />
                </PrivateRoute>
              }
            />
            <Route
              path="/manage-users"
              element={
                <PrivateRoute>
                  <ManageUsersPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/upload-data"
              element={
                <PrivateRoute>
                  <UploadDataPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <SettingsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/logscircles"
              element={
                <PrivateRoute>
                  <LogsCirclesPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/create-project"
              element={
                <PrivateRoute>
                  <ProjectsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/prediction-map"
              element={
                <PrivateRoute>
                  <PredictionMapPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/getreport"
              element={
                <PrivateRoute>
                  <GetReportPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/unified-map"
              element={
                <PrivateRoute>
                  <UnifiedMapView />
                </PrivateRoute>
              }
            />
            <Route
              path="/viewProject"
              element={
                <PrivateRoute>
                  <ViewProjectsPage />
                </PrivateRoute>
              }
            />

            {/* Catch-all for Not Found */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </SWRConfig>
      </AuthProvider>
    </Router>
  );
}

export default App;
