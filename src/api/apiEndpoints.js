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
      return await pythonApi.get('/health');
    } catch (error) {
      console.error('Python backend health check failed:', error);
      throw error;
    }
  },

  getInfo: async () => {
    try {
      return await pythonApi.get('/');
    } catch (error) {
      console.error('API Info Error:', error);
      throw error;
    }
  },
};

export const buildingApi = {
  generateBuildings: async (polygonData) => {
    try {
      return await pythonApi.post('/api/buildings/generate', polygonData);
    } catch (error) {
      console.error('Building API Error:', error);
      throw error;
    }
  },

  saveBuildingsWithProject: async (data) => {
    try {
      return await pythonApi.post('/api/buildings/save', data);
    } catch (error) {
      console.error('Save buildings error:', error);
      throw error;
    }
  },

  getProjectBuildings: async (projectId) => {
    try {
      return await pythonApi.get(`/api/buildings/project/${projectId}`);
    } catch (error) {
      console.error('Get project buildings error:', error);
      throw error;
    }
  },

  healthCheck: async () => {
    try {
      return await pythonApi.get('/api/buildings/health');
    } catch (error) {
      console.error('Building service health check failed:', error);
      throw error;
    }
  },
};

export const cellSiteApi = {
  /**
   * Verify project exists
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
   * Upload site file with progress tracking
   */
  uploadSite: async (formData, onUploadProgress = null) => {
    try {
      console.log('📤 Uploading site file...');
      
      // Log FormData contents
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: ${value.name} (${value.size} bytes)`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      }

      const response = await pythonApi.post('/api/process-and-save', formData, {
        timeout: 300000, // 5 minutes
        onUploadProgress: onUploadProgress || ((progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log(`Upload Progress: ${percentCompleted}%`);
        }),
      });

      console.log('✅ Site upload response:', response);
      return response;
    } catch (error) {
      console.error('❌ Cell Site upload error:', error);
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('Upload timed out. File may be too large.');
      }
      
      throw error;
    }
  },

  /**
   * Upload sessions
   */
  uploadSessions: async (payload) => {
    try {
      console.log('📤 Uploading sessions to Python backend...');
      console.log('Payload:', JSON.stringify(payload, null, 2));

      const response = await pythonApi.post('/api/cell-site/process-session', payload, {
        timeout: 300000, // 5 minutes
      });

      console.log('✅ Session upload response:', response);
      return response;
    } catch (error) {
      console.error('❌ Session upload error:', error);
      throw error;
    }
  },

  /**
   * Get site data by project with cancellation support
   */
  siteNoml: async (projectId, cancelToken = null) => {
    try {
      console.log(`🔍 Fetching SiteNoMl data for project ${projectId}...`);
      
      const config = {
        timeout: 30000, // 30 seconds
      };
      
      if (cancelToken) {
        config.cancelToken = cancelToken;
      }
      
      const response = await pythonApi.get(
        `/api/cell-site/site-noml/${projectId}`,
        config
      );
      
      console.log(`✅ Retrieved ${response.count || 0} sites for project ${projectId}`);
      return response;
    } catch (error) {
      // Handle cancellation
      if (axios.isCancel(error)) {
        console.log('Request canceled:', error.message);
        return null;
      }
      
      console.error('❌ siteNoml error:', error);
      
      // Return empty data for 404
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
   * Update project ID
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
   * Get project cell sites
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

  /**
   * Download file (opens in new tab)
   */
  downloadFile: (outputDir, filename) => {
    const baseUrl = import.meta.env.VITE_PYTHON_API_URL || "http://localhost:8080";
    const url = `${baseUrl}/api/cell-site/download/${outputDir}/${filename}`;
    console.log('📥 Downloading file:', url);
    window.open(url, '_blank');
  },

  /**
   * Download file as blob using axios
   */
  downloadFileBlob: async (outputDir, filename) => {
    try {
      console.log('📥 Downloading file as blob...');
      
      const response = await pythonApi.get(
        `/api/cell-site/download/${outputDir}/${filename}`,
        {
          responseType: 'blob', // Important for file downloads
        }
      );

      // Create download link
      const blob = new Blob([response]);
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
   * List output files
   */
  listOutputs: async (outputDir) => {
    try {
      return await pythonApi.get(`/api/cell-site/outputs/${outputDir}`);
    } catch (error) {
      console.error('❌ List outputs error:', error);
      throw error;
    }
  },

  /**
   * Health check
   */
  healthCheck: async () => {
    try {
      return await pythonApi.get('/api/cell-site/health');
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
    api.get("/Admin/AppQualityFlatV2", { 
      params: { from: startDate, to: endDate } 
    }),

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

    try {
      console.log("✅ Fetching network durations...");
      const response = await api.get("/Admin/GetNetworkDurations", {
        params: { fromDate: from, toDate: to }
      });
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
    api.get("/api/MapView/GetProjectPolygons", { 
      params: { projectId } 
    }),
  
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
    api.get("/api/MapView/GetNeighboursForPrimary", { 
      params: { sessionId: session } 
    }),

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
  uploadFile: (formData, onUploadProgress = null) => 
    api.post("/ExcelUpload/UploadExcelFile", formData, {
      onUploadProgress: onUploadProgress || ((progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log(`Upload Progress: ${percentCompleted}%`);
      }),
    }),
  
  downloadTemplate: (fileType) => {
    const url = `https://signaltrackers-1.onrender.com/ExcelUpload/DownloadExcel?fileType=${fileType}`;
    console.log('📥 Downloading template:', url);
    window.open(url, '_blank');
    return Promise.resolve({ success: true });
  },
  
  getUploadedFiles: (type) =>
    api.get("/ExcelUpload/GetUploadedExcelFiles", { 
      params: { FileType: type } 
    }),
    
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
    
    const pythonCheck = await cellSiteApi.verifyProject(projectId);
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