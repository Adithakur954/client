// AuthContext.jsx
import { createContext, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeApi } from '../api/apiEndpoints';
import { sha256 } from 'js-sha256';

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const s = sessionStorage.getItem('user');
    try { return s && s !== 'undefined' ? JSON.parse(s) : null; } catch { return null; }
  });
  const navigate = useNavigate();

  const login = async ({ Email, Password, IP = '' }) => {
    // Hash once, just like before
    const hashed = sha256(Password || '');
    const response = await homeApi.login({ Email, Password: hashed, IP });

    if (response.success) {
      setUser(response.user);
      sessionStorage.setItem('user', JSON.stringify(response.user));
    }
    return response;
  };

  const logout = async () => {
    try { await homeApi.logout(''); } catch {}
    setUser(null);
    sessionStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const isAuthenticated = () => !!user;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthProvider;