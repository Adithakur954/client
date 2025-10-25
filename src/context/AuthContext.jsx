// AuthContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeApi } from '../api/apiEndpoints';
import { sha256 } from 'js-sha256';

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const s = sessionStorage.getItem('user');
    try { 
      return s && s !== 'undefined' ? JSON.parse(s) : null; 
    } catch { 
      return null; 
    }
  });
  
  const navigate = useNavigate();

  // ✅ Listen for storage changes (logout in other tabs)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'user' && !e.newValue) {
        setUser(null);
        navigate('/login', { replace: true });
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [navigate]);

  const login = async ({ Email, Password, IP = '' }) => {
    try {
      const hashed = sha256(Password || '');
      const response = await homeApi.login({ Email, Password: hashed, IP });

      if (response.success) {
        setUser(response.user);
        sessionStorage.setItem('user', JSON.stringify(response.user));
      }
      return response;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try { 
      await homeApi.logout(''); 
    } catch (error) {
      console.error('Logout API failed:', error);
    } finally {
      // ✅ Always clear session, even if API fails
      setUser(null);
      sessionStorage.removeItem('user');
      navigate('/login', { replace: true });
    }
  };

  const isAuthenticated = () => !!user;

  // ✅ Add method to clear session (called from apiService on 401)
  const clearSession = () => {
    setUser(null);
    sessionStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated,
      clearSession // Export this if needed
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthProvider;