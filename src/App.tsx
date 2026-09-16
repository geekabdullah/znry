import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Activities } from '@/pages/Activities';
import { ActivityDetail } from '@/pages/ActivityDetail';
import { People } from '@/pages/People';
import { Workers } from '@/pages/Workers';
import { Reports } from '@/pages/Reports';
import { Spinner } from '@/components/ui';

function ProtectedRoutes() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-sand-50">
        <Spinner />
      </div>
    );
  }

  if (!session) return <Login />;
  if (!profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-sand-50 px-6 text-center">
        <div>
          <p className="font-display text-lg font-semibold text-ink-900">Setting up your office...</p>
          <p className="mt-1 text-sm text-ink-500">
            If this persists, ask the Finance & Admin to assign your profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/activities/:id" element={<ActivityDetail />} />
        <Route path="/people" element={<People />} />
        <Route path="/workers" element={<Workers />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ProtectedRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
