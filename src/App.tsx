import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Compare from "./pages/Compare";
import TeamBuilder from "./pages/TeamBuilder";
import Confrontos from "./pages/Confrontos";
import RadarAusencias from "./pages/RadarAusencias";
import Simulador from "./pages/Simulador";
import MercadoInteligente from "./pages/MercadoInteligente";
import Oportunidades from "./pages/Oportunidades";
import GeradorEstilo from "./pages/GeradorEstilo";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
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
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/team-builder" element={<TeamBuilder />} />
            <Route path="/confrontos" element={<Confrontos />} />
            <Route path="/ausencias" element={<RadarAusencias />} />
            <Route path="/simulador" element={<Simulador />} />
            <Route path="/mercado" element={<MercadoInteligente />} />
            <Route path="/oportunidades" element={<Oportunidades />} />
            <Route path="/gerador-estilo" element={<GeradorEstilo />} />
            
            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
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
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
