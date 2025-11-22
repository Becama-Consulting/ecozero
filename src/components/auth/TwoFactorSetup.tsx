import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, CheckCircle2, AlertTriangle, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

interface TwoFactorSetupProps {
  onSuccess?: () => void;
}

export const TwoFactorSetup = ({ onSuccess }: TwoFactorSetupProps) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'initial' | 'setup' | 'verify'>('initial');
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    check2FAStatus();
  }, []);

  const check2FAStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('two_factor_enabled')
        .eq('id', user.id)
        .single();

      setIs2FAEnabled(profile?.two_factor_enabled || false);
    } catch (error) {
      console.error('Error checking 2FA status:', error);
    }
  };

  const handleGenerate2FA = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sesión no válida');
        return;
      }

      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/two-factor-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'generate' }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al generar código 2FA');
      }

      setSecret(result.secret);
      setBackupCodes(result.backupCodes);

      // Generar QR code como imagen
      const qrCodeImage = await QRCode.toDataURL(result.qrCodeUrl);
      setQrCodeData(qrCodeImage);

      setStep('setup');
    } catch (error: any) {
      console.error('Error generating 2FA:', error);
      toast.error(error.message || 'Error al generar código 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    if (verificationCode.length !== 6) {
      toast.error('El código debe tener 6 dígitos');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sesión no válida');
        return;
      }

      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/two-factor-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'enable',
            code: verificationCode,
            secret: secret,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Código inválido');
      }

      toast.success('2FA activado correctamente');
      setStep('verify');
      setIs2FAEnabled(true);
      
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Error enabling 2FA:', error);
      toast.error(error.message || 'Error al activar 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!password) {
      toast.error('Contraseña requerida');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sesión no válida');
        return;
      }

      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/two-factor-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'disable',
            password: password,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al desactivar 2FA');
      }

      toast.success('2FA desactivado correctamente');
      setIs2FAEnabled(false);
      setShowDisableForm(false);
      setPassword('');
      setStep('initial');
    } catch (error: any) {
      console.error('Error disabling 2FA:', error);
      toast.error(error.message || 'Error al desactivar 2FA');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const downloadBackupCodes = () => {
    const text = `Códigos de respaldo 2FA - EcoCERO\nFecha: ${new Date().toLocaleDateString()}\n\n${backupCodes.join('\n')}\n\nGuarda estos códigos en un lugar seguro. Cada código solo puede usarse una vez.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecocero-backup-codes-${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Códigos de respaldo descargados');
  };

  // Vista inicial: 2FA no configurado
  if (!is2FAEnabled && step === 'initial') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-600" />
            <CardTitle>Autenticación de Dos Factores (2FA)</CardTitle>
          </div>
          <CardDescription>
            Añade una capa adicional de seguridad a tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              La autenticación de dos factores está desactivada. Actívala para proteger mejor tu cuenta.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              La autenticación de dos factores (2FA) requiere un código de verificación generado por una aplicación como:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Google Authenticator</li>
              <li>Microsoft Authenticator</li>
              <li>Authy</li>
              <li>1Password</li>
            </ul>
          </div>

          <Button 
            onClick={handleGenerate2FA} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Activar 2FA
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Vista de configuración: Escanear QR
  if (step === 'setup') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configurar Autenticación de Dos Factores</CardTitle>
          <CardDescription>
            Escanea el código QR con tu aplicación de autenticación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-center">
              {qrCodeData && (
                <img 
                  src={qrCodeData} 
                  alt="QR Code 2FA" 
                  className="w-64 h-64 border-2 border-gray-200 rounded-lg"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>O introduce este código manualmente:</Label>
              <div className="flex gap-2">
                <Input 
                  value={secret} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(secret)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Antes de continuar, asegúrate de haber guardado el código QR o el código secreto en tu aplicación de autenticación.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="verification-code">
              Introduce el código de 6 dígitos de tu aplicación:
            </Label>
            <Input
              id="verification-code"
              type="text"
              placeholder="123456"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl font-mono tracking-widest"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep('initial');
                setVerificationCode('');
              }}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEnable2FA}
              disabled={loading || verificationCode.length !== 6}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Activar 2FA'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Vista de códigos de respaldo
  if (step === 'verify' && backupCodes.length > 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <CardTitle>2FA Activado Correctamente</CardTitle>
          </div>
          <CardDescription>
            Guarda estos códigos de respaldo en un lugar seguro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>¡Importante!</strong> Estos códigos de respaldo solo se mostrarán una vez. Cada código puede usarse solo una vez si pierdes acceso a tu aplicación de autenticación.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 rounded-lg border">
            {backupCodes.map((code, index) => (
              <code key={index} className="text-sm font-mono">
                {code}
              </code>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => backupCodes.forEach(code => copyToClipboard(backupCodes.join('\n')))}
              className="flex-1"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar Todos
            </Button>
            <Button
              onClick={downloadBackupCodes}
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              setStep('initial');
              setBackupCodes([]);
            }}
            className="w-full"
          >
            Finalizar
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Vista: 2FA ya activado
  if (is2FAEnabled) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              <CardTitle>Autenticación de Dos Factores</CardTitle>
            </div>
            <Badge variant="default" className="bg-green-600">
              Activado
            </Badge>
          </div>
          <CardDescription>
            Tu cuenta está protegida con 2FA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              La autenticación de dos factores está activada. Se te pedirá un código de verificación cada vez que inicies sesión.
            </AlertDescription>
          </Alert>

          {!showDisableForm ? (
            <Button
              variant="destructive"
              onClick={() => setShowDisableForm(true)}
              className="w-full"
            >
              Desactivar 2FA
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">
                  Introduce tu contraseña para desactivar 2FA:
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña actual"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDisableForm(false);
                    setPassword('');
                  }}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDisable2FA}
                  disabled={loading || !password}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Desactivando...
                    </>
                  ) : (
                    'Confirmar Desactivación'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
};
