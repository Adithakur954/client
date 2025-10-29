// src/api/pythonApiService.js

const PYTHON_BASE_URL = import.meta.env.VITE_PYTHON_API_URL || "http://localhost:8080";

/**
 * Python API Service using fetch (similar pattern to your C# service)
 */
const pythonApiService = async (endpoint, { body, params, ...customOptions } = {}) => {
  const isFormData = body instanceof FormData;
  const headers = isFormData ? {} : { "Content-Type": "application/json" };

  const config = {
    method: customOptions.method || "GET",
    ...customOptions,
    headers: {
      ...headers,
      ...customOptions.headers,
    },
  };

  if (body) config.body = isFormData ? body : JSON.stringify(body);

  const url = new URL(`${PYTHON_BASE_URL}${endpoint}`);
  if (params) url.search = new URLSearchParams(params).toString();

  try {
    const response = await fetch(url.toString(), config);

    if (response.status === 204) return null;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(
        `Python API error! Status: ${response.status} - ${errorData.message || errorData.Message || "Unknown error"}`
      );
    }

    const responseText = await response.text();
    try {
      return JSON.parse(responseText);
    } catch (e) {
      return responseText;
    }
  } catch (error) {
    console.error(`Python API call to ${endpoint} failed:`, error);
    throw error;
  }
};

export const pythonApi = {
  get: (endpoint, options = {}) =>
    pythonApiService(endpoint, { ...options, method: "GET" }),
  post: (endpoint, body, options = {}) =>
    pythonApiService(endpoint, { ...options, method: "POST", body }),
  put: (endpoint, body, options = {}) =>
    pythonApiService(endpoint, { ...options, method: "PUT", body }),
  delete: (endpoint, options = {}) =>
    pythonApiService(endpoint, { ...options, method: "DELETE" }),
};

// Export the base URL for reference
export const PYTHON_BASE_URL_EXPORT = PYTHON_BASE_URL;