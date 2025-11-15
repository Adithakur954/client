// src/api/apiEndpoints.js
import { api } from "./apiService"; // C# Backend
import { pythonApi } from "./pythonApiService"; // Python Backend

/**
 * ============================================
 * PYTHON BACKEND APIs (Port 5000/8080)
 * ============================================
 */

export const generalApi = {
  healthCheck: async () => {
    try {
      const response = await pythonApi.get('/health');
      return response;
    } catch (error) {
      console.error('Python backend health check failed:', error);
      throw error;
    }
  },

  getInfo: async () => {
    try {
      const response = await pythonApi.get('/');
      return response;
    } catch (error) {
      console.error('API Info Error:', error);
      throw error;
    }
  },
};

export const buildingApi = {
  generateBuildings: async (polygonData) => {
    try {
      const response = await pythonApi.post('/api/buildings/generate', polygonData);
      return response;
    } catch (error) {
      console.error('Building API Error:', error);
      throw error;
    }
  },

  saveBuildingsWithProject: async (data) => {
    try {
      const response = await pythonApi.post('/api/buildings/save', data);
      return response;
    } catch (error) {
      console.error('Save buildings error:', error);
      throw error;
    }
  },

  getProjectBuildings: async (projectId) => {
    try {
      const response = await pythonApi.get(`/api/buildings/project/${projectId}`);
      return response;
    } catch (error) {
      console.error('Get project buildings error:', error);
      throw error;
    }
  },

  healthCheck: async () => {
    try {
      const response = await pythonApi.get('/api/buildings/health');
      return response;
    } catch (error) {
      console.error('Building service health check failed:', error);
      throw error;
    }
  },
};

export const cellSiteApi = {
  /**
   * ============================================
   * VERIFY PROJECT EXISTS (NEW)
   * ============================================
   */
  verifyProject: async (projectId) => {
    try {
      console.log(`🔍 Verifying project ${projectId} exists...`);
      const response = await pythonApi.get(`/api/cell-site/verify-project/${projectId}`);
      console.log('✅ Project verification response:', response);
      return response;
    } catch (error) {
      console.error('❌ Project verification failed:', error);
      throw error;
    }
  },

  /**
   * ============================================
   * UPLOAD SITE FILE
   * ============================================
   */
  uploadSite: async (formData) => {
    try {
      console.log('📤 Uploading site file...');
      
      // Log FormData contents (for debugging)
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: ${value.name} (${value.size} bytes)`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      }

      const response = await pythonApi.post('/api/process-and-save', formData, {
        signal: AbortSignal.timeout(300000), // 5 minutes
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('✅ Site upload response:', response);
      return response;
    } catch (error) {
      console.error('❌ Cell Site upload error:', error);
      
      // Provide more specific error messages
      if (error.code === 'ECONNABORTED') {
        throw new Error('Upload timed out. File may be too large.');
      } else if (error.response) {
        const errorMsg = error.response.data?.error || error.response.data?.message || 'Upload failed';
        throw new Error(errorMsg);
      }
      
      throw error;
    }
  },

  /**
   * ============================================
   * UPLOAD SESSIONS (NEW - was missing)
   * ============================================
   */
  uploadSessions: async (payload) => {
    try {
      console.log('📤 Uploading sessions to Python backend...');
      console.log('Payload:', JSON.stringify(payload, null, 2));

      const response = await pythonApi.post('/api/cell-site/process-session', payload, {
        timeout: 300000, // 5 minutes
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('✅ Session upload response:', response);
      return response;
    } catch (error) {
      console.error('❌ Session upload error:', error);
      
      if (error.response?.data) {
        const errorMsg = error.response.data.error || error.response.data.message || 'Session upload failed';
        throw new Error(errorMsg);
      }
      
      throw error;
    }
  },

  /**
   * ============================================
   * GET SITE DATA BY PROJECT
   * ============================================
   */
  siteNoml: async (projectId, signal = null) => {
    try {
      console.log(`🔍 Fetching SiteNoMl data for project ${projectId}...`);
      
      const config = {
        timeout: 30000, // 30 seconds
      };
      
      if (signal) {
        config.signal = signal;
      }
      
      const response = await pythonApi.get(
        `/api/cell-site/site-noml/${projectId}`,
        config
      );
      
      console.log(`✅ Retrieved ${response.count || 0} sites for project ${projectId}`);
      return response;
    } catch (error) {
      console.error('❌ siteNoml error:', error);
      
      // Return empty data instead of throwing for 404
      if (error.response?.status === 404) {
        console.warn(`⚠️ No site data found for project ${projectId}`);
        return {
          success: true,
          project_id: projectId,
          count: 0,
          data: [],
          message: 'No site data found'
        };
      }
      
      throw error;
    }
  },

  /**
   * ============================================
   * UPDATE PROJECT ID FOR EXISTING PREDICTION
   * ============================================
   */
  updateProjectId: async (filename, projectId) => {
    try {
      console.log(`🔄 Updating project ID for ${filename} to ${projectId}...`);
      
      const response = await pythonApi.post('/api/cell-site/update-project-id', {
        filename: filename,
        project_id: projectId,
      });

      console.log('✅ Project ID updated successfully');
      return response;
    } catch (error) {
      console.error('❌ Update project ID error:', error);
      throw error;
    }
  },

  /**
   * ============================================
   * GET PROJECT CELL SITES
   * ============================================
   */
  getProjectCellSites: async (projectId) => {
    try {
      console.log(`🔍 Fetching cell sites for project ${projectId}...`);
      const response = await pythonApi.get(`/api/cell-site/project/${projectId}`);
      console.log(`✅ Retrieved cell sites for project ${projectId}`);
      return response;
    } catch (error) {
      console.error('❌ Get project cell sites error:', error);
      throw error;
    }
  },

  
  downloadFile: (outputDir, filename) => {
    const baseUrl = import.meta.env.VITE_PYTHON_API_URL || "http://localhost:8080";
    const url = `${baseUrl}/api/cell-site/download/${outputDir}/${filename}`;
    console.log('📥 Downloading file:', url);
    window.open(url, '_blank');
  },

  downloadFileBlob: async (outputDir, filename) => {
    try {
      const baseUrl = import.meta.env.VITE_PYTHON_API_URL || "http://localhost:8080";
      const url = `${baseUrl}/api/cell-site/download/${outputDir}/${filename}`;
      
      console.log('📥 Downloading file as blob:', url);
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      console.log('✅ File downloaded successfully');
      return blob;
    } catch (error) {
      console.error('❌ Download error:', error);
      throw error;
    }
  },

  /**
   * ============================================
   * LIST OUTPUT FILES
   * ============================================
   */
  listOutputs: async (outputDir) => {
    try {
      const response = await pythonApi.get(`/api/cell-site/outputs/${outputDir}`);
      return response;
    } catch (error) {
      console.error('❌ List outputs error:', error);
      throw error;
    }
  },

  /**
   * ============================================
   * HEALTH CHECK
   * ============================================
   */
  healthCheck: async () => {
    try {
      const response = await pythonApi.get('/api/cell-site/health');
      return response;
    } catch (error) {
      console.error('Cell Site health check failed:', error);
      throw error;
    }
  },
};

/**
 * ============================================
 * C# BACKEND APIs (Port 5224)
 * ============================================
 */

export const authApi = {
  checkStatus: () => api.get("/api/auth/status"),
};

export const adminApi = {
  getReactDashboardData: () => api.get("/Admin/GetReactDashboardData"),
  getDashboardGraphData: () => api.get("/Admin/GetDashboardGraphData"),
  getIndoorCount: () => api.get("/Admin/IndoorCount"),
  getOutdoorCount: () => api.get("/Admin/OutdoorCount"),
  getAllUsers: (filters) => api.post("/Admin/GetAllUsers", filters),
  
  getAppValue: (startDate, endDate) => 
    api.get(`/Admin/AppQualityFlatV2?from=${startDate}&to=${endDate}`),

  getNetworkDurations: async (startDate, endDate) => {
    const formatDateLocal = (d) => {
      if (!d) return null;
      const dateObj = new Date(d);
      if (isNaN(dateObj)) return null;
      return dateObj.toISOString().split("T")[0];
    };

    const from = formatDateLocal(startDate);
    const to = formatDateLocal(endDate);

    if (!from || !to) throw new Error("Invalid date range");

    const url = `/Admin/GetNetworkDurations?fromDate=${encodeURIComponent(from)}&toDate=${encodeURIComponent(to)}`;

    try {
      console.log("✅ Network durations URL:", url);
      const response = await api.get(url);
      console.log("✅ Network durations response:", response);
      return response;
    } catch (err) {
      console.error("❌ Network durations error:", err);
      throw err;
    }
  },

  getUsers: (params) => api.get("/Admin/GetUsers", { params }),
  getOnlineUsers: () => api.get("/Admin/GetOnlineUsers"),
  
  getOperatorCoverageRanking: ({ min, max }) =>
    api.get("/Admin/GetOperatorCoverageRanking", { params: { min, max } }),
  
  getOperatorQualityRanking: ({ min, max }) =>
    api.get("/Admin/GetOperatorQualityRanking", { params: { min, max } }),
  
  getUserById: (userId) => {
    const formData = new FormData();
    formData.append("UserID", userId);
    formData.append("token", "");
    return api.post("/Admin/GetUser", formData);
  },

  getTotalsV2: () => api.get("/Admin/TotalsV2"),
  getMonthlySamplesV2: (params) => api.get("/Admin/MonthlySamplesV2", { params }),
  getOperatorSamplesV2: (params) => api.get("/Admin/OperatorSamplesV2", { params }),
  getNetworkTypeDistributionV2: (params) => api.get("/Admin/NetworkTypeDistributionV2", { params }),
  getAvgRsrpV2: (params) => api.get("/Admin/AvgRsrpV2", { params }),
  getAvgRsrqV2: (params) => api.get("/Admin/AvgRsrqV2", { params }),
  getAvgSinrV2: (params) => api.get("/Admin/AvgSinrV2", { params }),
  getAvgMosV2: (params) => api.get("/Admin/AvgMosV2", { params }),
  getAvgJitterV2: (params) => api.get("/Admin/AvgJitterV2", { params }),
  getAvgLatencyV2: (params) => api.get("/Admin/AvgLatencyV2", { params }),
  getAvgPacketLossV2: (params) => api.get("/Admin/AvgPacketLossV2", { params }),
  getAvgDlTptV2: (params) => api.get("/Admin/AvgDlTptV2", { params }),
  getAvgUlTptV2: (params) => api.get("/Admin/AvgUlTptV2", { params }),
  getBandDistributionV2: (params) => api.get("/Admin/BandDistributionV2", { params }),
  getHandsetDistributionV2: (params) => api.get("/Admin/HandsetDistributionV2", { params }),
  
  getOperatorsV2: () => api.get("/Admin/OperatorsV2"),
  getNetworksV2: () => api.get("/Admin/NetworksV2"),
  
  saveUserDetails: (data) => api.post("/Admin/SaveUserDetails", data),
  deleteUser: (id) => api.post(`/Admin/DeleteUser?id=${id}`),
  userResetPassword: (data) => api.post("/Admin/UserResetPassword", data),
  changePassword: (data) => api.post("/Admin/ChangePassword", data),
  getSessions: () => api.get("/Admin/GetSessions"),
  getAllNetworkLogs: (params) => api.get("/Admin/GetAllNetworkLogs", { params }),
  deleteSession: (sessionId) => api.delete(`/Admin/DeleteSession?id=${parseInt(sessionId, 10)}`),
  getSessionsByFilter: (filters) => api.get("/Admin/GetSessionsByDateRange", { params: filters }),
};

export const mapViewApi = {
  // ==================== User & Session Management ====================
  signup: (user) => api.post("/api/MapView/user_signup", user),
  startSession: (data) => api.post("/api/MapView/start_session", data),
  endSession: (data) => api.post("/api/MapView/end_session", data),

  // ==================== Polygon Management ====================
  getProjectPolygons: (projectId) =>
    api.get(`/api/MapView/GetProjectPolygons?projectId=${projectId}`),
  
  getProjectPolygonsV2: (projectId, source = 'map') =>
    api.get("/api/MapView/GetProjectPolygonsV2", { 
      params: { projectId, source } 
    }),
  
  savePolygon: (payload) => api.post("/api/MapView/SavePolygon", payload),
  
  savePolygonWithLogs: (payload) => 
    api.post("/api/MapView/SavePolygonWithLogs", payload),
  
  getAvailablePolygons: (projectId) => {
    const params = projectId !== undefined && projectId !== null 
      ? { projectId } 
      : {};
    return api.get("/api/MapView/GetAvailablePolygons", { params });
  },
  
  getPolygonLogCount: (polygonId, from, to) =>
    api.get("/api/MapView/GetPolygonLogCount", { 
      params: { polygonId, from, to } 
    }),
  
  listSavedPolygons: (projectId, limit = 200, offset = 0) =>
    api.get("/api/MapView/ListSavedPolygons", { 
      params: { projectId, limit, offset } 
    }),
  
  assignPolygonToProject: (polygonId, projectId) =>
    api.post("/api/MapView/AssignPolygonToProject", null, {
      params: { polygonId, projectId },
    }),

  // ==================== Project Management ====================
  getProjects: () => api.get("/api/MapView/GetProjects"),
  
  /**
   * Create project with polygons and sessions
   * @param {Object} payload - { ProjectName, PolygonIds, SessionIds }
   */
  createProjectWithPolygons: async (payload) => {
    try {
      console.log('📤 Creating project with payload:', JSON.stringify(payload, null, 2));
      
      const response = await api.post("/api/MapView/CreateProjectWithPolygons", payload);
      
      console.log('✅ Project created:', response);
      return response;
    } catch (error) {
      console.error('❌ Project creation error:', error);
      
      // Enhanced error handling
      if (error.response?.data) {
        const data = error.response.data;
        
        if (data.InnerException) {
          throw new Error(`Database Error: ${data.InnerException}`);
        } else if (data.Message) {
          throw new Error(data.Message);
        } else if (data.errors) {
          const validationErrors = Object.entries(data.errors)
            .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
            .join('; ');
          throw new Error(`Validation Error: ${validationErrors}`);
        }
      }
      
      throw error;
    }
  },

  // ==================== Network Logs ====================
  getNetworkLog: (sessionLike) => {
    const extractId = (s) => {
      if (s == null) return "";
      if (typeof s === "object") {
        const sid = s.session_id ?? s.id ?? s.SessionID ?? s.ID ?? s.value ??
          (s.params && s.params.session_id);
        return sid != null ? String(sid) : "";
      }
      return String(s);
    };
    const sid = extractId(sessionLike);
    return api.get("/api/MapView/GetNetworkLog", { params: { session_id: sid } });
  },

  getLogsByDateRange: (filters) =>
    api.get("/api/MapView/GetLogsByDateRange", { params: filters }),
  
  logNetwork: (data) => api.post("/api/MapView/log_networkAsync", data),

  getNeighbours: (session) => 
    api.get(`/api/MapView/GetNeighboursForPrimary?sessionId=${session}`),

  // ==================== Filter Options ====================
  getProviders: () => api.get("/api/MapView/GetProviders"),
  getTechnologies: () => api.get("/api/MapView/GetTechnologies"),
  getBands: () => api.get("/api/MapView/GetBands"),

  // ==================== Prediction Data ====================
  getPredictionLog: (params) => 
    api.get("/api/MapView/GetPredictionLog", { params }),
  
  getPredictionLogPost: (payload) => 
    api.post("/api/MapView/GetPredictionLog", payload),
  
  getPredictionDataForBuildings: (projectId, metric) =>
    api.get("/api/MapView/GetPredictionDataForSelectedBuildingPolygonsRaw", { 
      params: { projectId, metric } 
    }),

  // ==================== Site Prediction ====================
  uploadSitePredictionCsv: (formData) =>
    api.post("/api/MapView/UploadSitePredictionCsv", formData),
  
  getSitePrediction: (params) =>
    api.get("/api/MapView/GetSitePrediction", { params }),
  
  assignSitePredictionToProject: (projectId, siteIds) => {
    const params = new URLSearchParams();
    params.append('projectId', projectId);
    siteIds.forEach(id => params.append('siteIds', id));
    return api.post(`/api/MapView/AssignExistingSitePredictionToProject?${params.toString()}`);
  },

  // ==================== ML Site Data ====================
  getSiteNoMl: (params) => api.get("/api/MapView/GetSiteNoMl", { params }),
  getSiteMl: (params) => api.get("/api/MapView/GetSiteMl", { params }),

  // ==================== Image Upload ====================
  uploadImage: (formData) => api.post("/api/MapView/UploadImage", formData),
  uploadImageLegacy: (formData) => api.post("/api/MapView/UploadImageLegacy", formData),
};

export const homeApi = {
  login: (credentials) => api.post("/Home/UserLogin", credentials),
  getStateInfo: () => api.post("/Home/GetStateIformation"),
  forgotPassword: (data) => api.post("/Home/GetUserForgotPassword", data),
  resetPassword: (data) => api.post("/Home/ForgotResetPassword", data),
  logout: (ip) => api.get("/Home/Logout", { params: { IP: ip || "" } }),
  getLoggedUser: (ip) => api.post("/Home/GetLoggedUser", { ip }),
  getMasterUserTypes: () => api.get("/Home/GetMasterUserTypes"),
};

export const settingApi = {
  checkSession: () => api.get("/api/Setting/CheckSession"),
  getThresholdSettings: () => api.get("/api/Setting/GetThresholdSettings"),
  saveThreshold: (payload) => api.post("/api/Setting/SaveThreshold", payload),
};

export const excelApi = {
  uploadFile: (formData) => api.post("/ExcelUpload/UploadExcelFile", formData),
  
  downloadTemplate: (fileType) => {
    const url = `https://signaltrackers-1.onrender.com/ExcelUpload/DownloadExcel?fileType=${fileType}`;
    console.log('📥 Downloading template:', url);
    window.open(url, '_blank');
    return Promise.resolve({ success: true });
  },
  
  getUploadedFiles: (type) =>
    api.get(`/ExcelUpload/GetUploadedExcelFiles`, { params: { FileType: type } }),
    
  getSessions: (fromDate, toDate) =>
    api.get("/ExcelUpload/GetSessions", {
      params: {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      },
    }),
};

/**
 * ============================================
 * UTILITY FUNCTIONS
 * ============================================
 */

export const checkAllServices = async () => {
  try {
    const [pythonHealth, csharpHealth] = await Promise.allSettled([
      generalApi.healthCheck(),
      authApi.checkStatus(),
    ]);

    return {
      python: {
        healthy: pythonHealth.status === 'fulfilled',
        data: pythonHealth.value,
        error: pythonHealth.reason?.message,
      },
      csharp: {
        healthy: csharpHealth.status === 'fulfilled',
        data: csharpHealth.value,
        error: csharpHealth.reason?.message,
      },
    };
  } catch (error) {
    console.error('Service check failed:', error);
    return {
      python: { healthy: false, error: error.message },
      csharp: { healthy: false, error: error.message },
    };
  }
};

/**
 * Validate project exists in both backends
 */
export const validateProjectExists = async (projectId) => {
  try {
    if (!projectId) return false;
    
    // Check Python backend
    const pythonCheck = await cellSiteApi.verifyProject(projectId);
    
    // Optionally check C# backend too
    // const csharpCheck = await mapViewApi.getProjects();
    // const projectExists = csharpCheck.some(p => p.id === projectId);
    
    return pythonCheck.exists === true;
  } catch (error) {
    console.error('Project validation error:', error);
    return false;
  }
};

export default {
  // Python APIs
  generalApi,
  buildingApi,
  cellSiteApi,
  
  // C# APIs
  authApi,
  adminApi,
  mapViewApi,
  homeApi,
  settingApi,
  excelApi,
  
  // Utilities
  checkAllServices,
  validateProjectExists,
};