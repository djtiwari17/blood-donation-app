import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from '../types';

interface AppContextType {
  isAuthenticated: boolean;
  userRole: UserRole | null;
  currentUser: User | null;
  login: (role: UserRole, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

const AppContext = createContext<AppContextType>({
  isAuthenticated: false,
  userRole: null,
  currentUser: null,
  login: () => {},
  logout: () => {},
  updateUser: () => {},
});

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const login = (role: UserRole, user: User) => {
    setUserRole(role);
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    setCurrentUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
    setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
  };

  return (
    <AppContext.Provider value={{ isAuthenticated, userRole, currentUser, login, logout, updateUser }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
