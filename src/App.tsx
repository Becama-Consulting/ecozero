import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/auth/Index.tsx";
import Auth from "./pages/auth/Auth";
import AdminUsers from "./pages/admin/AdminUsers";
import DashboardGlobal from "./pages/admin/DashboardGlobal";
import DashboardProduccion from "./pages/produccion/DashboardProduccion";
import DetalleLinea from "./pages/produccion/DetalleLinea";
import FichaOF from "./pages/produccion/FichaOF";
import Alertas from "./pages/produccion/Alertas";
import { DashboardRRHH, Empleados, Fichajes, Turnos, Ausencias, Nominas, Documentacion, EmpleadosETT } from "./pages/rrhh";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/dashboard/global"
            element={
              <ProtectedRoute>
                <DashboardGlobal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/produccion"
            element={
              <ProtectedRoute>
                <DashboardProduccion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/produccion/linea/:lineaId"
            element={
              <ProtectedRoute>
                <DetalleLinea />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/produccion/of/:ofId"
            element={
              <ProtectedRoute>
                <FichaOF />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/produccion/alertas"
            element={
              <ProtectedRoute>
                <Alertas />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/rrhh"
            element={
              <ProtectedRoute>
                <DashboardRRHH />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/rrhh/empleados"empleados"
            element={
              <ProtectedRoute>
                <Empleados />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/rrhh/fichajes"/fichajes"
            element={
              <ProtectedRoute>
                <Fichajes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/rrhh/turnos"hh/turnos"
            element={
              <ProtectedRoute>
                <Turnos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/rrhh/ausencias"ausencias"
            element={
              <ProtectedRoute>
                <Ausencias />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/rrhh/nominas"h/nominas"
            element={
              <ProtectedRoute>
                <Nominas />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/rrhh/documentacion"mentacion"
            element={
              <ProtectedRoute>
                <Documentacion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/rrhh/empleados-ett"
            element={
              <ProtectedRoute>
                <EmpleadosETT />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
