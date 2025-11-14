import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Mail, Download, QrCode, Check } from "lucide-react";

interface GenerateCredentialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: Array<{ id: string; email: string; name: string; departamento?: string }>;
}

const generateRandomPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export const GenerateCredentialsModal = ({ open, onOpenChange, users }: GenerateCredentialsModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<typeof users[0] | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGeneratePassword = async () => {
    if (!selectedUser) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Selecciona un usuario primero",
      });
      return;
    }

    setLoading(true);
    try {
      const newPassword = generateRandomPassword();
      
      // Call edge function to regenerate password
      const { data, error } = await supabase.functions.invoke('regenerate-password', {
        body: {
          userId: selectedUser.id,
          password: newPassword
        }
      });

      if (error) {
        throw new Error(`Error al invocar función: ${error.message}`);
      }

      if (!data || !data.success) {
        const errorMsg = data?.error || 'Error desconocido al regenerar contraseña';
        throw new Error(errorMsg);
      }

      setGeneratedPassword(newPassword);
      toast({
        title: "Credenciales generadas",
        description: `Contraseña generada para ${selectedUser.name}`,
      });
    } catch (error) {
      console.error("Error generating password:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo generar la contraseña",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const credentials = `Email: ${selectedUser?.email}\nContraseña: ${generatedPassword}\nURL: ${window.location.origin}/auth`;
    navigator.clipboard.writeText(credentials);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copiado",
      description: "Credenciales copiadas al portapapeles",
    });
  };

  const handleReset = () => {
    setSelectedUser(null);
    setGeneratedPassword("");
    setSearchTerm("");
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleReset();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generar Acceso para Usuario</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!generatedPassword ? (
            <>
              {/* Step 1: Select User */}
              <div className="space-y-2">
                <Label>Paso 1: Seleccionar Usuario</Label>
                <Input
                  placeholder="Buscar usuario o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {filteredUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No se encontraron usuarios
                    </p>
                  ) : (
                    filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => setSelectedUser(user)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          selectedUser?.id === user.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs opacity-75">{user.email}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Step 2: Confirm Data */}
              {selectedUser && (
                <div className="space-y-2">
                  <Label>Paso 2: Confirmar Datos</Label>
                  <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
                    <div><span className="font-medium">Email:</span> {selectedUser.email}</div>
                    <div><span className="font-medium">Nombre:</span> {selectedUser.name}</div>
                    <div><span className="font-medium">Departamento:</span> {selectedUser.departamento || "N/A"}</div>
                  </div>
                </div>
              )}

              {/* Step 3: Generate */}
              <div className="space-y-2">
                <Label>Paso 3: Generar</Label>
                <Button
                  onClick={handleGeneratePassword}
                  disabled={!selectedUser || loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    "Generar Contraseña Aleatoria"
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Result */}
              <div className="space-y-4">
                <div className="bg-success/10 border border-success rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-success font-medium">
                    <Check className="w-5 h-5" />
                    Acceso Generado
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <div className="font-mono bg-background px-2 py-1 rounded mt-1">
                        {selectedUser?.email}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contraseña:</span>
                      <div className="font-mono bg-background px-2 py-1 rounded mt-1 break-all">
                        {generatedPassword}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">URL:</span>
                      <div className="font-mono bg-background px-2 py-1 rounded mt-1 text-xs">
                        {window.location.origin}/auth
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="w-full"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copiar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="w-full"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="w-full"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      QR
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground text-center pt-2">
                    ℹ️ Usuario debe cambiar contraseña al primer login
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="flex-1"
                  >
                    Cerrar
                  </Button>
                  <Button
                    onClick={handleReset}
                    className="flex-1"
                  >
                    Generar Otro
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
