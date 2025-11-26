// AuthContext.jsx - Cookie-based authentication
import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeApi } from '../api/apiEndpoints';
import { sha256 } from 'js-sha256';
import { setAuthErrorHandler } from '../api/apiService';

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  const navigate = useNavigate();

  /**
   * Clear session data
   */
  const clearSession = useCallback(() => {
    setUser(null);
    setAuthError(null);
    sessionStorage.removeItem('user');
    // No need to clear authToken - we use cookies now
  }, []);

  /**
   * Handle auth errors from API
   */
  const handleAuthError = useCallback(() => {
    clearSession();
    navigate('/login', { replace: true });
  }, [clearSession, navigate]);

  /**
   * Verify auth status with backend on mount
   * This checks if the cookie is still valid
   */
  useEffect(() => {
    const verifyAuthStatus = async () => {
      try {
        // Check if we have a cached user
        const cachedUser = sessionStorage.getItem('user');
        
        // Always verify with backend - cookie will be sent automatically
        const response = await homeApi.getAuthStatus();
        
        if (response?.user) {
          setUser(response.user);
          sessionStorage.setItem('user', JSON.stringify(response.user));
        } else {
          clearSession();
        }
      } catch (error) {
        console.log('Auth verification failed:', error.message);
        // If 401/403, user is not authenticated
        if (error.status === 401 || error.status === 403) {
          clearSession();
        } else {
          // Network error - use cached user if available
          const cachedUser = sessionStorage.getItem('user');
          if (cachedUser && cachedUser !== 'undefined') {
            try {
              setUser(JSON.parse(cachedUser));
            } catch {
              clearSession();
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };

    verifyAuthStatus();
  }, [clearSession]);

  /**
   * Set auth error handler for API interceptor
   */
  useEffect(() => {
    setAuthErrorHandler(handleAuthError);
    return () => setAuthErrorHandler(null);
  }, [handleAuthError]);

  /**
   * Handle cross-tab logout
   */
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'logout-event') {
        clearSession();
        navigate('/login', { replace: true });
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [clearSession, navigate]);

  /**
   * Login - cookie will be set by backend automatically
   */
  const login = async ({ Email, Password, IP = '' }) => {
    try {
      setAuthError(null);
      setLoading(true);
      
      const hashed = sha256(Password || '');
      const response = await homeApi.login({ Email, Password: hashed, IP });

      if (response.success) {
        // Cookie is automatically set by backend
        // We just need to store user data locally
        const userData = response.user;
        
        setUser(userData);
        sessionStorage.setItem('user', JSON.stringify(userData));
        
        return { success: true, user: userData };
      } else {
        const errorMessage = response.message || 'Login failed';
        setAuthError(errorMessage);
        return { success: false, message: errorMessage };
      }
    } catch (error) {
      console.error('Login failed:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      setAuthError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Logout - clear cookie on backend
   */
  const logout = async () => {
    try {
      setLoading(true);
      
      // Call backend to clear the auth cookie
      await homeApi.logout();
      
      // Trigger cross-tab logout
      localStorage.setItem('logout-event', Date.now().toString());
      localStorage.removeItem('logout-event');
      
    } catch (error) {
      console.error('Logout API failed:', error);
    } finally {
      clearSession();
      setLoading(false);
      navigate('/login', { replace: true });
    }
  };

  /**
   * Check authentication status
   */
  const isAuthenticated = useCallback(() => !!user, [user]);

  /**
   * Update user data
   */
  const updateUser = useCallback((updates) => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      const updatedUser = { ...prevUser, ...updates };
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  /**
   * Refresh user data from backend
   */
  const refreshUser = useCallback(async () => {
    try {
      const response = await homeApi.getAuthStatus();
      if (response?.user) {
        setUser(response.user);
        sessionStorage.setItem('user', JSON.stringify(response.user));
        return response.user;
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      if (error.status === 401 || error.status === 403) {
        clearSession();
      }
    }
    return null;
  }, [clearSession]);

  const contextValue = {
    user,
    loading,
    authError,
    isLoggedIn: !!user,
    login,
    logout,
    isAuthenticated,
    clearSession,
    updateUser,
    refreshUser,
    setAuthError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;