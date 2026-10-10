import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppErrorBoundary from "@/components/AppErrorBoundary";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Compare from "./pages/Compare";
import TeamBuilder from "./pages/TeamBuilder";
import HistoricoEscalacoes from "./pages/HistoricoEscalacoes";
import Confrontos from "./pages/Confrontos";
import RadarAusencias from "./pages/RadarAusencias";
import Simulador from "./pages/Simulador";
import MercadoInteligente from "./pages/MercadoInteligente";
import Oportunidades from "./pages/Oportunidades";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSync from "./pages/admin/AdminSync";
import AdminSettings from "./pages/admin/AdminSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/compare" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
            <Route path="/team-builder" element={<ProtectedRoute><TeamBuilder /></ProtectedRoute>} />
            <Route path="/historico" element={<ProtectedRoute><HistoricoEscalacoes /></ProtectedRoute>} />
            <Route path="/confrontos" element={<ProtectedRoute><Confrontos /></ProtectedRoute>} />
            <Route path="/ausencias" element={<ProtectedRoute><RadarAusencias /></ProtectedRoute>} />
            <Route path="/simulador" element={<ProtectedRoute><Simulador /></ProtectedRoute>} />
            <Route path="/mercado" element={<ProtectedRoute><MercadoInteligente /></ProtectedRoute>} />
            <Route path="/oportunidades" element={<ProtectedRoute><Oportunidades /></ProtectedRoute>} />
            
            {/* Admin routes */}
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
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </AppErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
