// src/api/apiEndpoints.js

import { api } from "./apiService";

/* ---------------- AUTH ---------------- */
export const authApi = {
  checkStatus: () => api.get("/api/auth/status"),
};

/* ---------------- ADMIN CONTROLLER ---------------- */
export const adminApi = {
  getReactDashboardData: () => api.get("/Admin/GetReactDashboardData"),
  getDashboardGraphData: () => api.get("/Admin/GetDashboardGraphData"),
  getAllUsers: (filters) => api.post("/Admin/GetAllUsers", filters),
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

  saveUserDetails: (data) => api.post("/Admin/SaveUserDetails", data),
  deleteUser: (id) => api.post(`/Admin/DeleteUser?id=${id}`),

  userResetPassword: (data) => api.post("/Admin/UserResetPassword", data),
  changePassword: (data) => api.post("/Admin/ChangePassword", data),

  getSessions: () => api.get("/Admin/GetSessions"),

  getAllNetworkLogs: (params) =>
    api.get("/Admin/GetAllNetworkLogs", { params }),

  // If your actual route is /Admin/DeleteSession?id=..., use that; the double segment looked suspicious
  deleteSession: (sessionId) =>
    api.delete(`/Admin/DeleteSession?id=${parseInt(sessionId, 10)}`),

  // IMPORTANT: pass filters via params for GET
  getSessionsByFilter: (filters) =>
    api.get("/Admin/GetSessionsByDateRange", { params: filters }),
};

/* ---------------- MAP VIEW CONTROLLER ---------------- */
export const mapViewApi = {
  signup: (user) => api.post("/api/MapView/user_signup", user),

  getLogsByDateRange: (filters) =>
    api.get("/api/MapView/GetLogsByDateRange", { params: filters }),

  startSession: (data) => api.post("/api/MapView/start_session", data),

  endSession: (data) => api.post("/api/MapView/end_session", data),
  createProjectWithPolygons: (payload) =>
    api.post("/api/MapView/CreateProjectWithPolygons", payload),
  getAvailablePolygons: () => api.get("/api/MapView/GetAvailablePolygons"),
  assignPolygonToProject: (polygonId, projectId) =>
    api.post("/api/MapView/AssignPolygonToProject", null, {
      params: { polygonId, projectId },
    }),

  getPredictionLog: (params) =>
    api.get("/api/MapView/GetPredictionLog", { params }), // yeh post hai get mein kar raha mai

  getNetworkLog: (sessionLike) => {
    const extractId = (s) => {
      if (s == null) return "";
      if (typeof s === "object") {
        const sid =
          s.session_id ??
          s.id ??
          s.SessionID ??
          s.ID ??
          s.value ??
          (s.params && s.params.session_id);
        return sid != null ? String(sid) : "";
      }
      return String(s);
    };
    const sid = extractId(sessionLike);
    console.log(
      "[mapViewApi.getNetworkLog] input:",
      sessionLike,
      "-> sid:",
      sid,
      "typeof sid:",
      typeof sid
    );
    return api.get("/api/MapView/GetNetworkLog", {
      params: { session_id: sid },
    });
  },
  // getPredictionLog: (params) =>
  //   api.get("/api/MapView/GetPredictionLog", { params }),

  getProjectPolygons: (projectId) =>
    api.get(`/api/MapView/GetProjectPolygons?projectId=${projectId}`),

  getProjects: () => api.get("/api/MapView/GetProjects"),
  getBands: () => api.get("/api/MapView/GetBands"),

  // Let the browser set the boundary automatically; do not set Content-Type manually
  uploadImage: (formData) => api.post("/api/MapView/UploadImage", formData),

  logNetwork: (data) => api.post("/api/MapView/log_networkAsync", data),

  getProviders: () => api.get("/api/MapView/GetProviders"),
  getTechnologies: () => api.get("/api/MapView/GetTechnologies"),
  savePolygon: (payload) => api.post("/api/MapView/SavePolygon", payload),
};

/* ---------------- HOME CONTROLLER ---------------- */
export const homeApi = {
  login: (credentials) => api.post("/Home/UserLogin", credentials),

  getStateInfo: () => api.post("/Home/GetStateIformation"),

  forgotPassword: (data) => api.post("/Home/GetUserForgotPassword", data),

  resetPassword: (data) => api.post("/Home/ForgotResetPassword", data),

  // Your controller Logout currently returns a Redirect (HTML). GET is safer here.
  // If you keep POST on the frontend, add [HttpPost] to the controller method.
  logout: (ip) => api.get("/Home/Logout", { params: { IP: ip || "" } }),

  getLoggedUser: (ip) => api.post("/Home/GetLoggedUser", { ip }),

  // Controller is [HttpGet], so call GET here
  getMasterUserTypes: () => api.get("/Home/GetMasterUserTypes"),
};

/* ---------------- SETTING CONTROLLER ---------------- */
export const settingApi = {
  checkSession: () => api.get("/api/Setting/CheckSession"),
  getThresholdSettings: () => api.get("/api/Setting/GetThresholdSettings"),
  saveThreshold: (payload) => api.post("/api/Setting/SaveThreshold", payload),
};

/* ---------------- EXCEL UPLOAD CONTROLLER ---------------- */
export const excelApi = {
  uploadFile: (formData) => api.post("/ExcelUpload/UploadExcelFile", formData),

  downloadTemplate: (fileType) =>
    api.get("/ExcelUpload/DownloadExcel", { params: { FileType: fileType } }),

  getUploadedFiles: (type) =>
    api.get(`/ExcelUpload/GetUploadedExcelFiles`, {
      params: { FileType: type },
    }),

  getSessions: (fromDate, toDate) =>
    api.get("/ExcelUpload/GetSessions", {
      params: {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      },
    }),
};
