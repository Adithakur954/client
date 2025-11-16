
// const API_BASE_URL = import.meta.env.VITE_CSHARP_API_URL || "http://localhost:5224";
const API_BASE_URL =  "http://13.204.241.153";

const apiService = async (endpoint, { body, params, ...customOptions } = {}) => {
  const isFormData = body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),

    "Cache-Control":"no-store",
    Pragma: "no-cache",
    ...customOptions.headers,
  };

  

  const config = {
    method: customOptions.method || "GET",
    ...customOptions,
    headers: {
      ...headers,
      ...customOptions.headers,
    },
    credentials: "include", 
  };

  if (body) config.body = isFormData ? body : JSON.stringify(body);

  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) url.search = new URLSearchParams(params).toString();

  try {
    const response = await fetch(url.toString(), config);

    // ✅ HANDLE 401 - Session Expired
    if (response.status === 401 || response.status == 403) {
      console.error("Unauthorized request. Session may have expired.");
      
      // Clear session storage
      sessionStorage.removeItem('user');
      
      // Redirect to login (only if not already on login page)
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      
      throw new Error('Session expired. Please login again.');
    }

    if (response.status === 204) return null;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(
        `HTTP error! Status: ${response.status} - ${errorData.message || "Unknown error"}`
      );
    }

    const responseText = await response.text();
    try {
      return JSON.parse(responseText);
    } catch (e) {
      return responseText;
    }
  } catch (error) {
    console.error(`API call to ${endpoint} failed:`, error);
    throw error;
  }
};

export const api = {
  get: (endpoint, options = {}) =>
    apiService(endpoint, { ...options, method: "GET" }),
  post: (endpoint, body, options = {}) =>
    apiService(endpoint, { ...options, method: "POST", body }),
  put: (endpoint, body, options = {}) =>
    apiService(endpoint, { ...options, method: "PUT", body }),
  delete: (endpoint, options = {}) =>
    apiService(endpoint, { ...options, method: "DELETE" }),
};

// Export the base URL for reference
export const CSHARP_BASE_URL = API_BASE_URL;