import { Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface UserCredentialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  password: string;
  userName: string;
}

export const UserCredentialsModal = ({
  open,
  onOpenChange,
  email,
  password,
  userName,
}: UserCredentialsModalProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const credentials = `Email: ${email}\nContraseña: ${password}`;
    
    try {
      await navigator.clipboard.writeText(credentials);
      setCopied(true);
      toast({
        title: "Credenciales copiadas",
        description: "Las credenciales se han copiado al portapapeles",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudieron copiar las credenciales",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Usuario Creado Exitosamente
          </DialogTitle>
          <DialogDescription>
            {userName} puede iniciar sesión con estas credenciales
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">📧 Email</p>
              <p className="font-mono text-sm">{email}</p>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground mb-1">🔑 Contraseña</p>
              <p className="font-mono text-sm font-medium">{password}</p>
            </div>
          </div>

          <Button
            onClick={handleCopy}
            className="w-full"
            variant={copied ? "outline" : "default"}
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copiar Credenciales
              </>
            )}
          </Button>

          <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 p-3">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              ⚠️ <strong>IMPORTANTE:</strong> Guarda esta contraseña. Solo se mostrará una vez.
            </p>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
            ℹ️ El usuario debe cambiar la contraseña en su primer inicio de sesión.
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
