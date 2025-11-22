import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Mail, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);

  useEffect(() => {
    checkVerificationStatus();
  }, []);

  const checkVerificationStatus = async () => {
    try {
      // Obtener el tipo de verificación de los parámetros
      const type = searchParams.get('type');
      const token = searchParams.get('token');

      if (type === 'email') {
        // El usuario ha hecho clic en el link del email
        // Supabase ya debería haber verificado el email automáticamente
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }

        if (session?.user?.email_confirmed_at) {
          setVerified(true);
          toast.success('¡Email verificado exitosamente!');
          
          // Redirigir al login después de 3 segundos
          setTimeout(() => {
            navigate('/auth/login');
          }, 3000);
        } else {
          setError('No se pudo verificar el email. El enlace puede haber expirado.');
        }
      } else {
        // Mostrar página de espera de verificación
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user?.email_confirmed_at) {
          setVerified(true);
        }
      }
    } catch (error: any) {
      console.error('Error verificando email:', error);
      setError('Ocurrió un error al verificar el email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setResendingEmail(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        toast.error('No se encontró el email del usuario');
        return;
      }

      // Reenviar email de verificación
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });

      if (error) throw error;

      toast.success('Email de verificación reenviado. Revisa tu bandeja de entrada.');
    } catch (error: any) {
      console.error('Error reenviando email:', error);
      toast.error('No se pudo reenviar el email de verificación');
    } finally {
      setResendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-green-600" />
              <p className="text-sm text-muted-foreground">Verificando email...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">¡Email Verificado!</CardTitle>
            <CardDescription className="text-center">
              Tu dirección de email ha sido confirmada exitosamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Ahora puedes iniciar sesión con tus credenciales
              </AlertDescription>
            </Alert>

            <Button
              onClick={() => navigate('/auth/login')}
              className="w-full"
            >
              Ir al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertCircle className="h-12 w-12 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Error de Verificación</CardTitle>
            <CardDescription className="text-center">
              No se pudo verificar tu email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Button
                onClick={handleResendEmail}
                disabled={resendingEmail}
                className="w-full"
                variant="outline"
              >
                {resendingEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reenviando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reenviar email de verificación
                  </>
                )}
              </Button>

              <Button
                onClick={() => navigate('/auth/login')}
                variant="ghost"
                className="w-full"
              >
                Volver al inicio de sesión
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Estado por defecto: esperando verificación
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Mail className="h-12 w-12 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Verifica tu Email</CardTitle>
          <CardDescription className="text-center">
            Te hemos enviado un email de verificación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              Revisa tu bandeja de entrada y haz clic en el enlace de verificación para activar tu cuenta.
            </AlertDescription>
          </Alert>

          <div className="bg-muted p-4 rounded-lg border space-y-2">
            <p className="text-sm font-medium">¿No recibiste el email?</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Revisa tu carpeta de spam o correo no deseado</li>
              <li>Verifica que la dirección de email sea correcta</li>
              <li>El email puede tardar unos minutos en llegar</li>
            </ul>
          </div>

          <Button
            onClick={handleResendEmail}
            disabled={resendingEmail}
            variant="outline"
            className="w-full"
          >
            {resendingEmail ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reenviando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reenviar email de verificación
              </>
            )}
          </Button>

          <div className="text-center">
            <Button
              variant="link"
              onClick={() => navigate('/auth/login')}
              className="text-sm"
            >
              Volver al inicio de sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;
