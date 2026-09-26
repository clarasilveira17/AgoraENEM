import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(authService.getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      if (token) {
        try {
          const userData = await authService.getMe();
          setUser(userData);
        } catch (err) {
          console.error('[AuthContext] Erro ao validar token:', err);
          setUser(null);
          setToken(null);
          authService.logout();
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    }
    checkAuth();
  }, [token]);

  const handleLogin = async (email, senha) => {
    setLoading(true);
    try {
      const data = await authService.login(email, senha);
      setToken(data.token);
      setUser(data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (userData) => {
    setLoading(true);
    try {
      const data = await authService.register(userData);
      setToken(data.token);
      setUser(data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setToken(null);
    setUser(null);
  };

  const syncLegacyToCloud = async (onProgress) => {
    return await authService.syncLegacyToCloud(onProgress);
  };

  const value = {
    user,
    token,
    loading,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    syncLegacyToCloud,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    isProfessor: user?.role === 'PROFESSOR',
    isTeacherOrAdmin: user?.role === 'ADMIN' || user?.role === 'PROFESSOR',
    isEstudante: user?.role === 'ESTUDANTE' || (!user?.role)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
