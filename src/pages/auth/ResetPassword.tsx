/**
 * Componente: ResetPassword
 * 
 * Pantalla donde el usuario introduce una nueva contraseña usando el token recibido por email.
 * Valida el token, permite cambiar la contraseña y muestra mensajes de éxito/error.
 * 
 * Ruta: /auth/reset-password/:token
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validar token al montar el componente
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setTokenError("Token no proporcionado");
      setValidating(false);
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('password-reset', {
        body: { 
          action: 'validate',
          token 
        },
      });

      if (error) {
        throw new Error('Error validando token');
      }

      if (!data.valid) {
        setTokenValid(false);
        setTokenError(data?.error || "Enlace de recuperación inválido o caducado.");
      } else {
        setTokenValid(true);
      }

    } catch (error) {
      console.error('Error validando token:', error);
      setTokenValid(false);
      setTokenError("Error al validar el enlace");
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (!password || !confirmPassword) {
      toast({
        variant: "destructive",
        title: "Campos requeridos",
        description: "Por favor completa todos los campos",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Contraseña muy corta",
        description: "La contraseña debe tener al menos 6 caracteres",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Las contraseñas no coinciden",
        description: "Por favor verifica que ambas contraseñas sean iguales",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('password-reset', {
        body: { 
          action: 'reset',
          token, 
          newPassword: password 
        },
      });

      if (error) {
        throw new Error('Error reseteando contraseña');
      }

      if (!data.success) {
        console.error('Error reseteando contraseña:', data.error);
        toast({
          variant: "destructive",
          title: "Error",
          description: data?.error || "No se pudo actualizar la contraseña",
        });
        setLoading(false);
        return;
      }

      console.log('✅ Contraseña actualizada correctamente');
      
      // Cerrar sesión para forzar login con nueva contraseña
      await supabase.auth.signOut();
      
      toast({
        title: "Contraseña actualizada",
        description: "Por seguridad, inicia sesión con tu nueva contraseña",
      });

      // Guardar flag para activar 2FA después del próximo login
      sessionStorage.setItem('require2faSetup', 'true');

      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        navigate('/auth?require2fa=true');
      }, 2000);

    } catch (error: any) {
      console.error('Error en reset password:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ocurrió un error al actualizar la contraseña",
      });
    } finally {
      setLoading(false);
    }
  };

  // Estado: Validando token
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-success/10 via-background to-info/10 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="bg-blue-500 rounded-full p-3">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Validando enlace...</h3>
                <p className="text-sm text-muted-foreground">
                  Verificando tu solicitud de recuperación
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Estado: Token inválido o expirado
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-success/10 via-background to-info/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-red-500 rounded-full p-3">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Enlace inválido</CardTitle>
            <CardDescription className="text-base">
              {tokenError}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                El enlace de recuperación puede haber expirado (válido por 1 hora) 
                o ya fue utilizado.
              </AlertDescription>
            </Alert>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/auth/forgot-password")}
            >
              Solicitar nuevo enlace
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/auth")}
            >
              Volver al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Estado: Contraseña actualizada con éxito - ya no se usa, redirige directo a 2FA
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-success/10 via-background to-info/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-green-500 rounded-full p-3">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">¡Contraseña actualizada!</CardTitle>
            <CardDescription className="text-base">
              Tu contraseña se ha actualizado correctamente
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Ahora puedes iniciar sesión con tu nueva contraseña.
                Serás redirigido automáticamente...
              </AlertDescription>
            </Alert>

            <Button
              className="w-full status-success"
              onClick={() => navigate("/auth")}
            >
              Ir al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Formulario principal de cambio de contraseña
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-success/10 via-background to-info/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-500 rounded-full p-3">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Nueva contraseña</CardTitle>
          <CardDescription className="text-base">
            Introduce tu nueva contraseña para restablecer tu cuenta
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 6 caracteres
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full status-success hover:bg-success/90"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Actualizar contraseña
                </>
              )}
            </Button>
          </form>

          {/* Requisitos de contraseña */}
          <div className="mt-6 p-4 bg-muted rounded-lg border border-border">
            <p className="text-sm font-medium mb-2">Requisitos de la contraseña:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Mínimo 6 caracteres</li>
              <li>Se recomienda usar mayúsculas, minúsculas y números</li>
              <li>Evita usar contraseñas fáciles de adivinar</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
