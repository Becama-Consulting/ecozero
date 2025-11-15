import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Users, Settings, FileText, LogOut, Shield, Activity, Key } from "lucide-react";
import { GenerateCredentialsModal } from "@/components/admin/GenerateCredentialsModal";

interface UserData {
  id: string;
  email: string;
  name: string;
  departamento?: string;
  roles: string[];
}

const DashboardGlobal = () => {
  const navigate = useNavigate();
  const { user, signOut, hasRole } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    admins: 0,
    activeOFs: 0,
    activeLines: 0,
    alerts: 0
  });
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!hasRole("admin_global")) {
      navigate("/");
    }
    loadStats();
    loadUsers();
  }, [hasRole, navigate]);

  const loadUsers = async () => {
    setLoadingUsers(true);
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
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadStats = async () => {
    try {
      const [usersData, rolesData, ofsData, linesData, alertsData] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("user_roles").select("id", { count: "exact" }).or("role.eq.admin_global,role.eq.admin_departamento"),
        supabase.from("fabrication_orders").select("id", { count: "exact" }).in("status", ["en_proceso", "pendiente"]),
        supabase.from("production_lines").select("id", { count: "exact" }).eq("status", "active"),
        supabase.from("alerts").select("id", { count: "exact" }).is("resolved_at", null).eq("severity", "critical")
      ]);

      setStats({
        totalUsers: usersData.count || 0,
        admins: rolesData.count || 0,
        activeOFs: ofsData.count || 0,
        activeLines: linesData.count || 0,
        alerts: alertsData.count || 0
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const departments = [
    { id: "produccion", name: "Producción", admin: "Ramón", status: "✓", color: "border-l-success" },
    { id: "logistica", name: "Logística", admin: "Judit", status: "✓", color: "border-l-info" },
    { id: "compras", name: "Compras", admin: "Sandra", status: "✓", color: "border-l-warning" },
    { id: "rrhh", name: "RRHH", admin: "Vero", status: "✓", color: "border-l-secondary" },
    { id: "comercial", name: "Comercial", admin: "Javier", status: "✓", color: "border-l-primary" },
    { id: "administrativo", name: "Administrativo", admin: "Ana", status: "✓", color: "border-l-muted" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-success/10 via-background to-info/10">
      {/* Header */}
      <header className="bg-white border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="gradient-primary rounded-full p-2">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Admin Global Dashboard</h1>
              <p className="text-xs text-muted-foreground">EcoCero - Control Central</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-2">
              <p className="text-sm font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Admin Global</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Administración Central */}
        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Administración Central
            </CardTitle>
            <CardDescription>
              Control total del sistema EcoCero
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Button
                onClick={() => navigate("/admin/users")}
                className="h-20 flex-col"
                variant="outline"
              >
                <Users className="w-6 h-6 mb-2" />
                <span className="text-sm">Gestión de Usuarios</span>
              </Button>
              <Button
                className="h-20 flex-col"
                variant="outline"
              >
                <Shield className="w-6 h-6 mb-2" />
                <span className="text-sm">Asignar Admins</span>
              </Button>
              <Button
                className="h-20 flex-col"
                variant="outline"
              >
                <Activity className="w-6 h-6 mb-2" />
                <span className="text-sm">Auditoría</span>
              </Button>
              <Button
                className="h-20 flex-col"
                variant="outline"
              >
                <FileText className="w-6 h-6 mb-2" />
                <span className="text-sm">Reportes</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Estado del Sistema */}
        <Card>
          <CardHeader>
            <CardTitle>Estado del Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-success">{stats.totalUsers}</p>
                <p className="text-sm text-muted-foreground">Usuarios Activos</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-info">{stats.admins}</p>
                <p className="text-sm text-muted-foreground">Admins Depto</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-warning">{stats.activeOFs}</p>
                <p className="text-sm text-muted-foreground">OFs en Progreso</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-success">{stats.activeLines}/2</p>
                <p className="text-sm text-muted-foreground">Líneas Funcionando</p>
              </div>
              <div className="text-center">
                <p className={`text-3xl font-bold ${stats.alerts > 0 ? "text-destructive" : "text-success"}`}>
                  {stats.alerts}
                </p>
                <p className="text-sm text-muted-foreground">Alertas Críticas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Departamentos */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Departamentos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <Card key={dept.id} className={`border-l-4 ${dept.color}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{dept.name}</CardTitle>
                  <CardDescription>
                    Admin: {dept.admin}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estado:</span>
                    <span className="text-lg font-semibold text-success">{dept.status}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Acciones Rápidas */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Button
                variant="outline"
                onClick={() => navigate("/admin/users")}
              >
                + Nuevo Usuario
              </Button>
              <Button 
                variant="outline"
                onClick={() => setIsCredentialsModalOpen(true)}
              >
                <Key className="w-4 h-4 mr-2" />
                Generar Credenciales
              </Button>
              <Button variant="outline">
                Ver Auditoría
              </Button>
              <Button variant="outline">
                Configuración
              </Button>
              <Button variant="outline">
                Backup BD
              </Button>
              <Button variant="outline">
                Reportes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Modal de Credenciales */}
        <GenerateCredentialsModal
          open={isCredentialsModalOpen}
          onOpenChange={setIsCredentialsModalOpen}
          users={users}
        />
      </main>
    </div>
  );
};

export default DashboardGlobal;
