// src/api/apiService.js - Cookie-based authentication
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_CSHARP_API_URL;
const isDev = import.meta.env.DEV;

let authErrorHandler = null;
let isRedirecting = false;

export const setAuthErrorHandler = (handler) => {
  authErrorHandler = handler;
};

const logger = {
  log: (...args) => isDev && console.log(...args),
  error: (...args) => isDev && console.error(...args),
  warn: (...args) => isDev && console.warn(...args),
};

/**
 * Axios instance - Cookie-based auth (no Bearer token needed)
 */
const csharpAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  withCredentials: true, // ⚠️ CRITICAL: This sends cookies with every request
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
  },
});

/**
 * Request Interceptor
 */
csharpAxios.interceptors.request.use(
  (config) => {
    logger.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    // Handle FormData
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    // NO Bearer token needed - cookies are sent automatically with withCredentials: true
    
    return config;
  },
  (error) => {
    logger.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 */
csharpAxios.interceptors.response.use(
  (response) => {
    logger.log(`✅ API Response: ${response.config.url}`, response.status);
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data, config } = error.response;
      
      // Handle 401 Unauthorized / 403 Forbidden
      if (status === 401 || status === 403) {
        logger.error('🔒 Unauthorized! Session expired or not authenticated.');
        
        // Clear local storage
        sessionStorage.removeItem('user');
        
        // Prevent redirect loop
        if (!isRedirecting && !config.url?.includes('/auth/status')) {
          isRedirecting = true;
          
          if (authErrorHandler) {
            try {
              authErrorHandler();
            } catch (e) {
              logger.error('Auth handler error:', e);
              fallbackRedirect();
            }
          } else {
            fallbackRedirect();
          }
          
          setTimeout(() => {
            isRedirecting = false;
          }, 1000);
        }
        
        const authError = new Error('Session expired. Please login again.');
        authError.isAuthError = true;
        authError.status = status;
        return Promise.reject(authError);
      }
      
      // Other errors
      const errorMessage = extractErrorMessage(data, error.message);
      logger.error(`❌ API Error [${status}]:`, { url: config?.url, data });
      
      const apiError = new Error(`HTTP ${status}: ${errorMessage}`);
      apiError.status = status;
      apiError.data = data;
      return Promise.reject(apiError);
      
    } else if (error.request) {
      logger.error('❌ No Response:', error.request);
      const networkError = new Error('No response from server. Please check your connection.');
      networkError.isNetworkError = true;
      return Promise.reject(networkError);
    } else {
      logger.error('❌ Request Setup Error:', error.message);
      return Promise.reject(error);
    }
  }
);

const extractErrorMessage = (data, fallback) => {
  if (!data) return fallback || 'Unknown error';
  if (typeof data === 'string') return data;
  return data.message || data.Message || data.error || data.detail || data.title || fallback;
};

const fallbackRedirect = () => {
  if (!window.location.pathname.includes('/login')) {
    sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
    window.location.href = '/login';
  }
};

/**
 * API Service
 */
const apiService = async (endpoint, options = {}) => {
  try {
    const response = await csharpAxios({
      url: endpoint,
      ...options,
    });
    
    if (response.status === 204) return null;
    return response.data;
  } catch (error) {
    logger.error(`API call to ${endpoint} failed:`, error.message);
    throw error;
  }
};

/**
 * Exported API methods
 */
export const api = {
  get: (endpoint, options = {}) =>
    apiService(endpoint, { ...options, method: 'GET' }),
  
  post: (endpoint, body, options = {}) =>
    apiService(endpoint, { ...options, method: 'POST', data: body }),
  
  put: (endpoint, body, options = {}) =>
    apiService(endpoint, { ...options, method: 'PUT', data: body }),
  
  patch: (endpoint, body, options = {}) =>
    apiService(endpoint, { ...options, method: 'PATCH', data: body }),
  
  delete: (endpoint, options = {}) =>
    apiService(endpoint, { ...options, method: 'DELETE' }),
  
  upload: (endpoint, formData, options = {}) =>
    apiService(endpoint, { ...options, method: 'POST', data: formData }),
};

export const CSHARP_BASE_URL = API_BASE_URL;
export const csharpAxiosInstance = csharpAxios;
export const isAuthError = (error) => error?.isAuthError === true;
export const isNetworkError = (error) => error?.isNetworkError === true;

export default api;