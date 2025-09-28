// src/api/apiService.js

// const API_BASE_URL =
//   import.meta.env.VITE_API_BASE_URL; // match your backend URL and scheme

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5224";
const apiService = async (endpoint, { body, params, ...customOptions } = {}) => {
  const isFormData = body instanceof FormData;
  const headers = isFormData ? {} : { "Content-Type": "application/json" };

  const config = {
    method: customOptions.method || "GET",
    ...customOptions,
    headers: {
      ...headers,
      ...customOptions.headers,
    },
    credentials: "include", // required for cookie/session auth
  };

  if (body) config.body = isFormData ? body : JSON.stringify(body);

  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) url.search = new URLSearchParams(params).toString();

  try {
    const response = await fetch(url.toString(), config);

    if (response.status === 401) {
      console.error("Unauthorized request. Session may have expired.");
      // Optionally: auto-logout or redirect here
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

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    return response.blob(); // for files/HTML/redirect content
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