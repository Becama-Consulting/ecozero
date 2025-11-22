import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import Auth from "./pages/auth/Auth.tsx";
import TwoFactorVerification from "./pages/auth/TwoFactorVerification";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import VerifyEmail from "./pages/auth/VerifyEmail";
import SecuritySettings from "./pages/profile/SecuritySettings";
import AdminUsers from "./pages/admin/AdminUsers";
import DashboardGlobal from "./pages/admin/DashboardGlobal";
import DashboardProduccion from "./pages/produccion/DashboardProduccion";
import DashboardSupervisor from "./pages/produccion/DashboardSupervisor";
import SecuenciacionProduccion from "./pages/produccion/SecuenciacionProduccion";
import GestionNaves from "./pages/produccion/GestionNaves";
import RegistroDatos from "./pages/produccion/RegistroDatos";
import DetallePedido from "./pages/produccion/DetallePedido";
import DetalleLinea from "./pages/produccion/DetalleLinea";
import FichaOF from "./pages/produccion/FichaOF";
import Alertas from "./pages/produccion/Alertas";
import { DashboardRRHH, Empleados, Fichajes, Turnos, Ausencias, Nominas, Documentacion, EmpleadosETT } from "./pages/rrhh";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

const AppContent = () => {
  // Hook para cerrar sesión al cerrar pestaña/ventana (seguridad corporativa)
  useAutoLogout();

  return (
    <Routes>
      {/* ========================================
          RUTAS DE AUTENTICACIÓN Y SEGURIDAD
          ======================================== */}
      {/* Login principal */}
      <Route path="/auth" element={<Auth />} />
          
          {/* Verificación en dos pasos (2FA) */}
          <Route path="/auth/2fa" element={<TwoFactorVerification />} />
          
          {/* Verificación de email */}
          <Route path="/auth/verify-email" element={<VerifyEmail />} />
          
          {/* Recuperación de contraseña */}
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password/:token" element={<ResetPassword />} />
          
          {/* Configuración de seguridad (2FA) - ruta protegida */}
          <Route
            path="/profile/security"
            element={
              <ProtectedRoute>
                <SecuritySettings />
              </ProtectedRoute>
            }
          />

          {/* ========================================
              RUTAS DE ADMINISTRACIÓN
              ======================================== */}
          <Route
            path="/admin/dashboard"
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
            path="/dashboard/produccion/supervisor"
            element={
              <ProtectedRoute allowedRoles={['admin_global', 'admin_departamento', 'supervisor']}>
                <DashboardSupervisor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/produccion/secuenciacion"
            element={
              <ProtectedRoute allowedRoles={['admin_global', 'admin_departamento', 'supervisor']}>
                <SecuenciacionProduccion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/produccion/naves"
            element={
              <ProtectedRoute allowedRoles={['admin_global', 'admin_departamento', 'supervisor']}>
                <GestionNaves />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/produccion/registro"
            element={
              <ProtectedRoute>
                <RegistroDatos />
              </ProtectedRoute>
            }
            />
          <Route
            path="/dashboard/produccion/pedido/:pedidoId"
            element={
              <ProtectedRoute allowedRoles={['admin_global', 'admin_departamento', 'supervisor', 'operario', 'quality']}>
                <DetallePedido />
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
            path="/dashboard/rrhh/empleados"
            element={
              <ProtectedRoute>
                <Empleados />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/rrhh/fichajes"
            element={
              <ProtectedRoute>
                <Fichajes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/rrhh/turnos"
            element={
              <ProtectedRoute>
                <Turnos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/rrhh/ausencias"
            element={
              <ProtectedRoute>
                <Ausencias />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/rrhh/nominas"
            element={
              <ProtectedRoute>
                <Nominas />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/rrhh/documentacion"
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
            element={<Navigate to="/auth" replace />}
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      );
    };

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
