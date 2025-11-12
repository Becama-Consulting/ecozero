import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, ArrowLeft, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GenerateCredentialsModal } from "@/components/GenerateCredentialsModal";

interface UserData {
  id: string;
  email: string;
  name: string;
  departamento?: string;
  roles: string[];
}

type AppRole = "admin_global" | "admin_departamento" | "supervisor" | "operario" | "quality";

const AdminUsers = () => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  
  // Form state
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newDepartamento, setNewDepartamento] = useState<string>("");
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);

  // Verify admin access
  useEffect(() => {
    if (user && !hasRole("admin_global")) {
      navigate("/");
      toast({
        variant: "destructive",
        title: "Acceso denegado",
        description: "Solo admins globales pueden acceder a esta página",
      });
    }
  }, [user, hasRole, navigate, toast]);

  // Load users
  useEffect(() => {
    if (hasRole("admin_global")) {
      loadUsers();
    }
  }, [hasRole]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, name, departamento");

      if (profilesError) throw profilesError;

      // Get roles for each user
      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roles, error: rolesError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);

          if (rolesError) throw rolesError;

          return {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            departamento: profile.departamento || "N/A",
            roles: roles?.map((r) => r.role) || [],
          };
        })
      );

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los usuarios",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail || !newName) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Email y nombre son requeridos",
      });
      return;
    }

    if (selectedRoles.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Debes seleccionar al menos un rol",
      });
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create user in Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: Math.random().toString(36).slice(-12), // Random password
        options: {
          data: { name: newName },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No user returned from signup");

      // Step 2: Update profile with department
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          departamento: newDepartamento 
            ? newDepartamento as "produccion" | "logistica" | "compras" | "rrhh" | "comercial" | "administrativo"
            : null 
        })
        .eq("id", authData.user.id);

      if (profileError) throw profileError;

      // Step 3: Assign roles
      for (const role of selectedRoles) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: authData.user.id, role });

        if (roleError) throw roleError;
      }

      toast({
        title: "Usuario creado",
        description: `${newName} (${newEmail}) ha sido creado con éxito`,
      });

      // Reset form
      setNewEmail("");
      setNewName("");
      setNewDepartamento("");
      setSelectedRoles([]);
      setIsDialogOpen(false);

      // Reload users
      loadUsers();
    } catch (error) {
      console.error("Error creating user:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo crear el usuario",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${userName}?`)) {
      return;
    }

    setLoading(true);
    try {
      // Delete roles
      const { error: rolesError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (rolesError) throw rolesError;

      // Delete profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (profileError) throw profileError;

      toast({
        title: "Usuario eliminado",
        description: `${userName} ha sido eliminado`,
      });

      loadUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el usuario",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (role: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin_global":
        return "bg-red-500";
      case "admin_departamento":
        return "bg-orange-500";
      case "supervisor":
        return "bg-blue-500";
      case "operario":
        return "bg-green-500";
      case "quality":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  const getDepartamentoLabel = (dept: string | null) => {
    if (!dept) return "N/A";
    const labels: Record<string, string> = {
      produccion: "Producción",
      logistica: "Logística",
      compras: "Compras",
      rrhh: "RRHH",
      comercial: "Comercial",
      administrativo: "Administrativo",
    };
    return labels[dept] || dept;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-success/10 via-background to-info/10">
      {/* Header */}
      <header className="bg-white border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/")}
              className="touch-target"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
              <p className="text-xs text-muted-foreground">Panel administrativo</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsCredentialsModalOpen(true)}
              variant="outline"
              className="touch-target"
            >
              <Key className="w-4 h-4 mr-2" />
              Generar Credenciales
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="status-success touch-target">
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Usuario
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-email">Email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="usuario@ecocero.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-name">Nombre Completo</Label>
                  <Input
                    id="new-name"
                    type="text"
                    placeholder="Juan Pérez"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="departamento">Departamento</Label>
                  <Select value={newDepartamento} onValueChange={setNewDepartamento}>
                    <SelectTrigger id="departamento">
                      <SelectValue placeholder="Selecciona departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="produccion">Producción</SelectItem>
                      <SelectItem value="logistica">Logística</SelectItem>
                      <SelectItem value="compras">Compras</SelectItem>
                      <SelectItem value="rrhh">RRHH</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="administrativo">Administrativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label>Roles</Label>
                  <div className="space-y-2 bg-muted p-3 rounded-lg">
                    {(
                      [
                        "admin_global",
                        "admin_departamento",
                        "supervisor",
                        "operario",
                        "quality",
                      ] as AppRole[]
                    ).map((role) => (
                      <div key={role} className="flex items-center space-x-2">
                        <Checkbox
                          id={role}
                          checked={selectedRoles.includes(role)}
                          onCheckedChange={() => toggleRole(role)}
                          disabled={loading}
                        />
                        <Label htmlFor={role} className="font-normal cursor-pointer">
                          {role.replace(/_/g, " ")}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={handleCreateUser}
                  className="w-full status-success touch-target"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Crear Usuario
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </header>

      {/* Generate Credentials Modal */}
      <GenerateCredentialsModal
        open={isCredentialsModalOpen}
        onOpenChange={setIsCredentialsModalOpen}
        users={users.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          departamento: u.departamento === "N/A" ? null : u.departamento
        }))}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Usuarios del Sistema</CardTitle>
            <CardDescription>
              {users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && users.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay usuarios registrados</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userData) => (
                      <TableRow key={userData.id}>
                        <TableCell className="font-mono text-sm">{userData.email}</TableCell>
                        <TableCell>{userData.name}</TableCell>
                        <TableCell>{getDepartamentoLabel(userData.departamento)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {userData.roles.length > 0 ? (
                              userData.roles.map((role) => (
                                <Badge
                                  key={role}
                                  className={`${getRoleBadgeColor(role)} text-white text-xs`}
                                >
                                  {role.replace(/_/g, " ")}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Sin roles
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(userData.id, userData.name)}
                            disabled={loading || user?.id === userData.id}
                            className="touch-target"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminUsers;
