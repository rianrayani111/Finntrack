import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const RoleLoading = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function RoleGuard({ allowedRoles = [] }) {
  const { authChecked, isLoadingAuth, role, isAuthenticated } = useAuth();

  if (!authChecked || isLoadingAuth) {
    return <RoleLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to={role === 'parent' ? '/parent' : '/'} replace />;
  }

  return <Outlet />;
}
