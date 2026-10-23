import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppErrorBoundary from "@/components/AppErrorBoundary";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Compare = lazy(() => import("./pages/Compare"));
const TeamBuilder = lazy(() => import("./pages/TeamBuilder"));
const HistoricoEscalacoes = lazy(() => import("./pages/HistoricoEscalacoes"));
const Confrontos = lazy(() => import("./pages/Confrontos"));
const RadarAusencias = lazy(() => import("./pages/RadarAusencias"));
const Simulador = lazy(() => import("./pages/Simulador"));
const MercadoInteligente = lazy(() => import("./pages/MercadoInteligente"));
const Oportunidades = lazy(() => import("./pages/Oportunidades"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminSync = lazy(() => import("./pages/admin/AdminSync"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    // Avoid automatically repeating writes or sync actions.
    mutations: {
      retry: 0,
    },
  },
});

const RouteLoadingFallback = () => (
  <main
    className="flex min-h-screen items-center justify-center p-6"
    role="status"
    aria-live="polite"
    aria-label="Carregando página"
  >
    <div className="w-full max-w-md space-y-4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <span className="sr-only">Carregando página…</span>
    </div>
  </main>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppErrorBoundary>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route
                  path="/dashboard"
                  element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
                />
                <Route
                  path="/compare"
                  element={<ProtectedRoute><Compare /></ProtectedRoute>}
                />
                <Route
                  path="/team-builder"
                  element={<ProtectedRoute><TeamBuilder /></ProtectedRoute>}
                />
                <Route
                  path="/historico"
                  element={<ProtectedRoute><HistoricoEscalacoes /></ProtectedRoute>}
                />
                <Route
                  path="/confrontos"
                  element={<ProtectedRoute><Confrontos /></ProtectedRoute>}
                />
                <Route
                  path="/ausencias"
                  element={<ProtectedRoute><RadarAusencias /></ProtectedRoute>}
                />
                <Route
                  path="/simulador"
                  element={<ProtectedRoute><Simulador /></ProtectedRoute>}
                />
                <Route
                  path="/mercado"
                  element={<ProtectedRoute><MercadoInteligente /></ProtectedRoute>}
                />
                <Route
                  path="/oportunidades"
                  element={<ProtectedRoute><Oportunidades /></ProtectedRoute>}
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="/admin/users" element={<Navigate to="/admin" replace />} />
                <Route
                  path="/admin/sync"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminSync />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminSettings />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AppErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
