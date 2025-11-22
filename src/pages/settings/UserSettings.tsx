import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, User, Lock } from "lucide-react";
import { TwoFactorSetup } from "@/components/auth";
import { toast } from "sonner";

const UserSettings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Configuración de Usuario</h1>
            <p className="text-muted-foreground">
              Gestiona tu cuenta y preferencias de seguridad
            </p>
          </div>
        </div>

        {/* Información del usuario */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-600" />
              <CardTitle>Información de la cuenta</CardTitle>
            </div>
            <CardDescription>
              Detalles de tu cuenta de usuario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <div className="text-sm font-medium text-muted-foreground">Email</div>
              <div className="text-base font-medium">{user?.email}</div>
            </div>
            <Separator />
            <div className="grid gap-2">
              <div className="text-sm font-medium text-muted-foreground">ID de Usuario</div>
              <div className="text-xs font-mono text-muted-foreground">{user?.id}</div>
            </div>
          </CardContent>
        </Card>

        {/* Seguridad */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-gray-600" />
              <CardTitle>Seguridad</CardTitle>
            </div>
            <CardDescription>
              Configura opciones de seguridad adicionales
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Cambiar contraseña */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Contraseña</h3>
              <p className="text-sm text-muted-foreground">
                Actualiza tu contraseña regularmente para mantener tu cuenta segura
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/auth/forgot-password')}
              >
                Cambiar contraseña
              </Button>
            </div>

            <Separator />

            {/* Autenticación de Dos Factores */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Autenticación de Dos Factores (2FA)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Añade una capa adicional de seguridad requiriendo un código de verificación al iniciar sesión
                </p>
              </div>
              
              <TwoFactorSetup 
                onSuccess={() => {
                  toast.success('Configuración de 2FA actualizada');
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Sesión */}
        <Card>
          <CardHeader>
            <CardTitle>Sesión</CardTitle>
            <CardDescription>
              Gestiona tu sesión actual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={async () => {
                await signOut();
                toast.success('Sesión cerrada correctamente');
                navigate('/auth/login');
              }}
            >
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserSettings;
