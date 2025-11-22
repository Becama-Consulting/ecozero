import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Loader2 } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, user, loading: authLoading, userRoles } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Redirect según rol - AHORA VERIFICA 2FA OBLIGATORIO
  useEffect(() => {
    console.log('🔍 Auth useEffect triggered:', {
      authLoading,
      hasUser: !!user,
      userRolesLength: userRoles.length,
      userRoles: userRoles
    });

    if (!authLoading && user && userRoles.length > 0) {
      // Verificar si debe configurar 2FA obligatoriamente
      const require2faSetup = sessionStorage.getItem('require2faSetup');
      
      if (require2faSetup === 'true') {
        console.log('🔒 Usuario debe configurar 2FA obligatoriamente (post password reset)');
        sessionStorage.removeItem('require2faSetup');
        navigate('/profile/security?force2fa=true', { replace: true });
        return;
      }
      
      // 🔐 NUEVO: Verificar si el usuario tiene 2FA configurado (OBLIGATORIO)
      const check2FAStatus = async () => {
        try {
          // Pequeña espera para asegurar que la sesión esté completamente establecida
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('two_factor_enabled')
            .eq('id', user.id)
            .single();

          if (!profile?.two_factor_enabled) {
            // Usuario NO tiene 2FA configurado → FORZAR configuración
            console.log('⚠️ 2FA NO CONFIGURADO - Forzando configuración obligatoria');
            navigate('/profile/security?force2fa=true', { replace: true });
            return;
          }

          // Usuario tiene 2FA configurado → redirigir según rol
          console.log('✅ Usuario autenticado con 2FA activo, redirigiendo según rol...');
          
          if (userRoles.some(r => r.role === 'admin_global')) {
            navigate('/admin/dashboard', { replace: true });
          } else if (userRoles.some(r => r.role === 'supervisor')) {
            navigate('/dashboard/produccion/supervisor', { replace: true });
          } else {
            navigate('/dashboard/produccion', { replace: true });
          }
        } catch (error) {
          console.error('Error verificando 2FA:', error);
        }
      };

      check2FAStatus();
    } else if (!authLoading && user && userRoles.length === 0) {
      // Usuario autenticado pero sin roles aún, esperar un poco
      console.log('⏳ Usuario autenticado pero sin roles, esperando...');
      setShowLoadingScreen(true);
      
      const timeout = setTimeout(() => {
        // Si después de 3 segundos no hay roles, redirigir a producción por defecto
        console.log('⏱️ Timeout: redirigiendo a producción por defecto');
        setShowLoadingScreen(false);
        navigate('/dashboard/produccion', { replace: true });
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [authLoading, user, userRoles, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail?.trim() || !loginPassword) {
      console.log('⚠️ Email o password vacío');
      return;
    }
    
    console.log('🔐 Iniciando login...');
    setLoading(true);
    setShowLoadingScreen(true);
    
    // PASO 1: Validar email + contraseña
    const { error } = await signIn(loginEmail.trim(), loginPassword);
    
    if (error) {
      console.log('❌ Error en login:', error);
      setShowLoadingScreen(false);
      setLoading(false);
      return;
    }

    // PASO 2: Verificar si el usuario tiene 2FA habilitado
    console.log('✅ Credenciales válidas, verificando 2FA...');
    
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (!userId) {
        console.log('❌ No se pudo obtener userId');
        setShowLoadingScreen(false);
        setLoading(false);
        return;
      }

      // Consultar si el usuario tiene 2FA activo
      const { data: profile } = await supabase
        .from('profiles')
        .select('two_factor_enabled')
        .eq('id', userId)
        .single();

      if (profile?.two_factor_enabled) {
        // Usuario tiene 2FA: redirigir a pantalla de verificación TOTP
        console.log('🔐 Usuario tiene 2FA activo, redirigiendo a verificación...');
        
        // NO cerrar la sesión - mantenerla para verificar el código 2FA
        navigate('/auth/2fa', { 
          state: { 
            userId: userId,
            email: loginEmail.trim() 
          },
          replace: true 
        });
        return; // Importante: salir aquí para no continuar con el flujo normal
      } else {
        // Usuario NO tiene 2FA: continuar con login normal
        console.log('✅ Login exitoso sin 2FA, preparando redirect...');
        // El useEffect de arriba se encargará del redirect según rol
      }
    } catch (error) {
      console.error('Error verificando 2FA:', error);
      // Si falla la verificación, continuar con login normal
      console.log('⚠️ Error verificando 2FA, continuando con login normal');
    } finally {
      setShowLoadingScreen(false);
      setLoading(false);
    }
  };

  // Pantalla de carga
  if (showLoadingScreen) {
    console.log('📺 Mostrando pantalla de carga');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-success/10 via-background to-info/10">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="gradient-primary rounded-full p-3">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Accediendo...</h3>
                <p className="text-sm text-muted-foreground">
                  Verificando permisos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si hay user autenticado y ya se redirigió, no mostrar form
  // PERO: si estamos aquí significa que el redirect falló, así que no bloquear indefinidamente
  const hasRedirected = sessionStorage.getItem('hasRedirected');
  if (user && hasRedirected && !authLoading) {
    // Mostrar loader mientras se limpia el flag y reintenta
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-success/10 via-background to-info/10">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="gradient-primary rounded-full p-3">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Redirigiendo...</h3>
                <p className="text-sm text-muted-foreground">
                  Accediendo a tu dashboard
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Signup deshabilitado - los usuarios se crean desde Admin Panel
  // No se permite auto-registro público

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-success/10 via-background to-info/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="gradient-primary rounded-full p-3">
              <Zap className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl md:text-3xl font-bold">EcoCero</CardTitle>
          <CardDescription className="text-base">
            Sistema de Automatización Integral
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-1 mb-4">
              <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <button
                      type="button"
                      onClick={() => navigate('/auth/forgot-password')}
                      className="text-xs text-primary hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full status-success hover:bg-success/90"
                  disabled={loading}
                >
                  {loading ? "Iniciando..." : "Iniciar Sesión"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 p-4 bg-muted rounded-lg border border-border">
            <p className="text-sm text-muted-foreground text-center">
              ¿Eres nuevo? Contacta al administrador para crear tu cuenta.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;