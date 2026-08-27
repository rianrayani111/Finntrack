import { Suspense, lazy } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleGuard from '@/components/RoleGuard';
import SubscriptionGate from '@/components/SubscriptionGate';

// Every page used to be a static import, so the app shipped as one ~1.4MB
// chunk: a public visitor on the marketing site downloaded every parent page,
// every child page, and the full 84-badge achievement catalogue before ever
// seeing the Home page render, and vice versa for a logged-in family. Each
// route now loads its own chunk on demand -- the shared bundle is just the
// app shell (router, auth context, layout wrappers) plus whatever the current
// route actually needs.
const Login = lazy(() => import("@/pages/Login"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Terms = lazy(() => import("@/pages/Terms"));
const AppLayout = lazy(() => import("@/components/AppLayout"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AddTransaction = lazy(() => import("@/pages/AddTransaction"));
const MonthlySummary = lazy(() => import("@/pages/MonthlySummary"));
const TransactionHistory = lazy(() => import("@/pages/TransactionHistory"));
const Goals = lazy(() => import('@/pages/Goals'));
const Requests = lazy(() => import('@/pages/Requests'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const Achievements = lazy(() => import('@/pages/Achievements'));
const Profile = lazy(() => import("@/pages/Profile"));
const ParentLayout = lazy(() => import('@/components/ParentLayout'));
const ParentDashboard = lazy(() => import('@/pages/ParentDashboard'));
const ParentAddMoney = lazy(() => import('@/pages/ParentAddMoney'));
const ParentRequests = lazy(() => import('@/pages/ParentRequests'));
const ParentTasks = lazy(() => import('@/pages/ParentTasks'));
const ParentAlerts = lazy(() => import('@/pages/ParentAlerts'));
const ParentAddChild = lazy(() => import('@/pages/ParentAddChild'));
const ParentChildDetail = lazy(() => import('@/pages/ParentChildDetail'));
const ParentGoals = lazy(() => import('@/pages/ParentGoals'));
const ParentEditTransaction = lazy(() => import('@/pages/ParentEditTransaction'));
const ParentSettings = lazy(() => import('@/pages/ParentSettings'));
const Home = lazy(() => import('@/pages/Home'));
const About = lazy(() => import('@/pages/About'));
const FAQ = lazy(() => import('@/pages/FAQ'));
const Resources = lazy(() => import('@/pages/Resources'));
const ResourceArticle = lazy(() => import('@/pages/ResourceArticle'));

const FullScreenSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const RoleHome = () => {
  const { role, authChecked } = useAuth();

  if (!authChecked) {
    return <FullScreenSpinner />;
  }

  if (role === 'parent') {
    return <Navigate to="/parent" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

const RootRoute = () => {
  const { isAuthenticated, authChecked, role } = useAuth();

  if (!authChecked) {
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
  const { authChecked, isLoadingPublicSettings } = useAuth();

  // Gate on authChecked (a one-way latch, set once the first auth check
  // completes) rather than isLoadingAuth, which flips true again for any
  // background re-check (tab refocus, token refresh) — that would otherwise
  // unmount the ENTIRE routed app, including whatever's on /login (e.g. a
  // parent mid-way through the multi-step signup/OTP flow), on every such
  // recheck.
  if (isLoadingPublicSettings || !authChecked) {
    return <FullScreenSpinner />;
  }

  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/about" element={<About />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/resources/:slug" element={<ResourceArticle />} />

        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/app" element={<RoleHome />} />

          <Route element={<SubscriptionGate />}>
            <Route element={<RoleGuard allowedRoles={["child"]} />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/add" element={<AddTransaction />} />
                <Route path="/summary" element={<MonthlySummary />} />
                <Route path="/history" element={<TransactionHistory />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/requests" element={<Requests />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
            </Route>

            <Route element={<RoleGuard allowedRoles={["parent"]} />}>
              <Route path="/parent" element={<ParentLayout />}>
                <Route index element={<ParentDashboard />} />
                <Route path="add-money" element={<ParentAddMoney />} />
                <Route path="goals" element={<ParentGoals />} />
                <Route path="requests" element={<ParentRequests />} />
                <Route path="tasks" element={<ParentTasks />} />
                <Route path="alerts" element={<ParentAlerts />} />
                <Route path="transactions/:transactionId/edit" element={<ParentEditTransaction />} />
                <Route path="add-child" element={<ParentAddChild />} />
                <Route path="children/:childId" element={<ParentChildDetail />} />
                <Route path="settings" element={<ParentSettings />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
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
