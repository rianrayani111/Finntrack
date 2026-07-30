import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Terms from "@/pages/Terms";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import AddTransaction from "@/pages/AddTransaction";
import MonthlySummary from "@/pages/MonthlySummary";
import TransactionHistory from "@/pages/TransactionHistory";
import Goals from '@/pages/Goals';
import Profile from "@/pages/Profile";
import ParentLayout from '@/components/ParentLayout';
import ParentDashboard from '@/pages/ParentDashboard';
import ParentAddMoney from '@/pages/ParentAddMoney';
import ParentAlerts from '@/pages/ParentAlerts';
import ParentAddChild from '@/pages/ParentAddChild';
import ParentChildDetail from '@/pages/ParentChildDetail';
import ParentGoals from '@/pages/ParentGoals';
import ParentEditTransaction from '@/pages/ParentEditTransaction';
import RoleGuard from '@/components/RoleGuard';
import Home from '@/pages/Home';

const RoleHome = () => {
  const { role, isLoadingAuth, authChecked } = useAuth();

  if (!authChecked || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (role === 'parent') {
    return <Navigate to="/parent" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

const RootRoute = () => {
  const { isAuthenticated, isLoadingAuth, authChecked, role } = useAuth();

  if (!authChecked || isLoadingAuth) {
    return <Home />;
  }

  if (isAuthenticated) {
    if (role === 'parent') {
      return <Navigate to="/parent" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Home />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/app" element={<RoleHome />} />

        <Route element={<RoleGuard allowedRoles={["child"]} />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/add" element={<AddTransaction />} />
            <Route path="/summary" element={<MonthlySummary />} />
            <Route path="/history" element={<TransactionHistory />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        <Route element={<RoleGuard allowedRoles={["parent"]} />}>
          <Route path="/parent" element={<ParentLayout />}>
            <Route index element={<ParentDashboard />} />
            <Route path="add-money" element={<ParentAddMoney />} />
            <Route path="goals" element={<ParentGoals />} />
            <Route path="alerts" element={<ParentAlerts />} />
            <Route path="transactions/:transactionId/edit" element={<ParentEditTransaction />} />
            <Route path="add-child" element={<ParentAddChild />} />
            <Route path="children/:childId" element={<ParentChildDetail />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App