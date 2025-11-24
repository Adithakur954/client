// src/api/apiService.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_CSHARP_API_URL || "http://localhost:5224";
// const API_BASE_URL = "http://signaltrackers-1.onrender.com";
// const API_BASE_URL = "http://13.204.241.153";

/**
 * Create axios instance for C# backend
 */
const csharpAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 1 minute default
  withCredentials: true, // Include cookies
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
    console.log(`🚀 C# API Request: ${config.method.toUpperCase()} ${config.url}`);
    
    // Handle FormData - let browser set content-type with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    // Add auth token if exists (optional)
    const token = sessionStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('❌ C# API Request Error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 */
csharpAxios.interceptors.response.use(
  (response) => {
    console.log(`✅ C# API Response: ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      
      // Handle 401 Unauthorized / 403 Forbidden
      if (status === 401 || status === 403) {
        console.error('🔒 Unauthorized! Session expired.');
        
        // Clear session
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('authToken');
        
        // Redirect to login (avoid loop)
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        
        error.message = 'Session expired. Please login again.';
      } else {
        // Other errors
        const errorMessage = 
          data?.message || 
          data?.Message || 
          data?.error || 
          error.message || 
          'Unknown error occurred';
        
        error.message = `HTTP error! Status: ${status} - ${errorMessage}`;
      }
      
      console.error(`❌ C# API Error [${status}]:`, data);
    } else if (error.request) {
      console.error('❌ C# API No Response:', error.request);
      error.message = 'No response from C# backend. Server may be down.';
    } else {
      console.error('❌ C# API Request Setup Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

/**
 * C# API Service
 */
const apiService = async (endpoint, options = {}) => {
  try {
    const response = await csharpAxios({
      url: endpoint,
      ...options,
    });
    
    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }
    
    return response.data;
  } catch (error) {
    console.error(`C# API call to ${endpoint} failed:`, error.message);
    throw error;
  }
};

/**
 * Exported C# API methods
 */
export const api = {
  get: (endpoint, options = {}) =>
    apiService(endpoint, { ...options, method: 'GET' }),
  
  post: (endpoint, body, options = {}) =>
    apiService(endpoint, { 
      ...options, 
      method: 'POST', 
      data: body 
    }),
  
  put: (endpoint, body, options = {}) =>
    apiService(endpoint, { 
      ...options, 
      method: 'PUT', 
      data: body 
    }),
  
  delete: (endpoint, options = {}) =>
    apiService(endpoint, { ...options, method: 'DELETE' }),
};

// Export base URL and axios instance
export const CSHARP_BASE_URL = API_BASE_URL;
export const csharpAxiosInstance = csharpAxios;