import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useNotifications } from "@/hooks/useNotifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, Plus, Map, Key, Bell } from "lucide-react";
import { toast } from "sonner";
import { GenerateCredentialsModal } from "@/components/admin/GenerateCredentialsModal";
import { CreateOFModal } from "@/components/produccion/CreateOFModal";
import { OFFilters, type OFFilters as OFFiltersType } from "@/components/produccion/OFFilters";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LineaStats {
  id: string;
  name: string;
  status: "active" | "paused" | "error";
  ofs_activas: number;
  capacity: number;
  tiempo_promedio: string;
  ultima_actualizacion: string;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  departamento?: string;
  roles: string[];
}

const DashboardProduccion = () => {
  const { user, isAdmin, hasRole, signOut } = useAuth();
  const { permission, requestPermission } = useNotifications();
  const navigate = useNavigate();
  const [lineas, setLineas] = useState<LineaStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOFs, setTotalOFs] = useState(0);
  const [completadasHoy, setCompletadasHoy] = useState(0);
  const [alertas, setAlertas] = useState(0);
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [isCreateOFModalOpen, setIsCreateOFModalOpen] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);
  const [filters, setFilters] = useState<OFFiltersType>({});
  const [recentOFs, setRecentOFs] = useState<any[]>([]);
  const [priorityAlerts, setPriorityAlerts] = useState<any[]>([]);
  const [showAllOFs, setShowAllOFs] = useState(false);
  const [selectedLineForAssignment, setSelectedLineForAssignment] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  useEffect(() => {
    if (!user) return;

    // Acceso permitido para: admin_global, admin_departamento, supervisor, operario, quality
    // (básicamente todos los roles de producción)
    
    fetchDashboardData();
    loadUsers();
    setupRealtimeSubscriptions();
  }, [user, filters, showAllOFs]);

  const loadUsers = async () => {
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
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Fetch production lines
      const { data: lines, error: linesError } = await supabase
        .from("production_lines")
        .select("*")
        .order("name");

      if (linesError) throw linesError;

      // Applied filters are now handled when fetching specific data below

      // Fetch OFs for each line
      const lineasStats: LineaStats[] = await Promise.all(
        (lines || []).map(async (line) => {
          const { count } = await supabase
            .from("fabrication_orders")
            .select("id", { count: "exact", head: true })
            .eq("line_id", line.id)
            .in("status", ["pendiente", "en_proceso"]);

          // Calcular tiempo promedio real de OFs completadas en últimos 30 días
          const { data: completedOFs } = await supabase
            .from("fabrication_orders")
            .select("started_at, completed_at")
            .eq("line_id", line.id)
            .eq("status", "completada")
            .not("started_at", "is", null)
            .not("completed_at", "is", null)
            .gte("completed_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

          let tiempo_promedio = "N/A";
          if (completedOFs && completedOFs.length > 0) {
            const totalMinutes = completedOFs.reduce((sum, of) => {
              const start = new Date(of.started_at).getTime();
              const end = new Date(of.completed_at).getTime();
              return sum + ((end - start) / (1000 * 60));
            }, 0);
            
            const avgMinutes = Math.round(totalMinutes / completedOFs.length);
            const hours = Math.floor(avgMinutes / 60);
            const minutes = avgMinutes % 60;
            tiempo_promedio = `${hours}h ${minutes}m`;
          }

          return {
            id: line.id,
            name: line.name,
            status: line.status,
            ofs_activas: count || 0,
            capacity: line.capacity,
            tiempo_promedio,
            ultima_actualizacion: new Date(line.updated_at).toLocaleString("es-ES"),
          };
        })
      );

      setLineas(lineasStats);

      // Fetch total OFs
      const { count: totalCount } = await supabase
        .from("fabrication_orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["pendiente", "en_proceso"]);

      setTotalOFs(totalCount || 0);

      // Fetch completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: completedCount } = await supabase
        .from("fabrication_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "completada")
        .gte("completed_at", today.toISOString());

      setCompletadasHoy(completedCount || 0);

      // Fetch active alerts
      const { count: alertsCount } = await supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .is("resolved_at", null);

      setAlertas(alertsCount || 0);

      // Construir query de OFs con filtros aplicados
      let ofsQuery = supabase
        .from("fabrication_orders")
        .select(`
          id,
          sap_id,
          customer,
          status,
          priority,
          created_at,
          line_id,
          production_lines (name)
        `)
        .order("created_at", { ascending: false });

      // Aplicar filtros si existen
      if (filters.status && filters.status !== 'all') {
        ofsQuery = ofsQuery.eq('status', filters.status as any);
      }
      if (filters.lineId && filters.lineId !== 'all') {
        ofsQuery = ofsQuery.eq('line_id', filters.lineId);
      }
      if (filters.customer) {
        ofsQuery = ofsQuery.ilike('customer', `%${filters.customer}%`);
      }
      if (filters.dateFrom) {
        ofsQuery = ofsQuery.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        ofsQuery = ofsQuery.lte('created_at', filters.dateTo);
      }

      const { data: recentOFsData, error: ofsError } = await ofsQuery.limit(showAllOFs ? 50 : 10);

      if (ofsError) throw ofsError;
      setRecentOFs(recentOFsData || []);

      // Fetch alertas prioritarias (no resueltas, ordenadas por severity)
      const { data: priorityAlertsData, error: alertsError } = await supabase
        .from("alerts")
        .select(`
          id,
          message,
          severity,
          type,
          created_at,
          related_of_id
        `)
        .is("resolved_at", null)
        .order("severity", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);

      if (alertsError) throw alertsError;
      setPriorityAlerts(priorityAlertsData || []);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Error al cargar datos del dashboard");
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel("produccion-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_lines" },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fabrication_orders" },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => fetchDashboardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-success border-l-4 border-success bg-success/5";
      case "paused":
        return "text-warning border-l-4 border-warning bg-warning/5";
      case "error":
        return "text-destructive border-l-4 border-destructive bg-destructive/5";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return "🟢";
      case "paused":
        return "🟡";
      case "error":
        return "🔴";
      default:
        return "⚪";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "✓ Funcionando correctamente";
      case "paused":
        return "⚠ En progreso - revisar";
      case "error":
        return "✗ Crítico - Línea parada";
      default:
        return "Estado desconocido";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🔴";
      case "warning":
        return "🟠";
      case "info":
        return "🟡";
      default:
        return "⚪";
    }
  };

  const produccionData = [
    { dia: 'L', completadas: 12, pendientes: 5 },
    { dia: 'M', completadas: 15, pendientes: 3 },
    { dia: 'X', completadas: 10, pendientes: 7 },
    { dia: 'J', completadas: 18, pendientes: 2 },
    { dia: 'V', completadas: 14, pendientes: 4 },
    { dia: 'S', completadas: 8, pendientes: 6 },
    { dia: 'Hoy', completadas: completadasHoy, pendientes: totalOFs }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard Producción</h1>
            <p className="text-muted-foreground mt-1">
              Bienvenido, {user?.email}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/dashboard/produccion/alertas")} variant="outline">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Alertas ({alertas})
            </Button>
            {hasRole('admin_global') ? (
              <Button onClick={() => navigate("/")}>Volver al inicio</Button>
            ) : (
              <Button variant="outline" onClick={handleSignOut}>Salir</Button>
            )}
          </div>
        </div>

        {/* Notificaciones Push */}
        {permission === 'default' && (
          <Card className="border-warning">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-warning" />
                  <div>
                    <h3 className="font-semibold">Activar Notificaciones</h3>
                    <p className="text-sm text-muted-foreground">
                      Recibe alertas críticas en tiempo real
                    </p>
                  </div>
                </div>
                <Button onClick={requestPermission} variant="default">
                  Activar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Métricas Globales */}
        <Card>
          <CardHeader>
            <CardTitle>Estado del Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total OFs activas</p>
                <p className="text-2xl font-bold text-foreground">{totalOFs}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Líneas OK</p>
                <p className="text-2xl font-bold text-green-600">
                  {lineas.filter((l) => l.status === "active").length}/{lineas.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completadas hoy</p>
                <p className="text-2xl font-bold text-foreground">{completadasHoy}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alertas</p>
                <p className="text-2xl font-bold text-destructive">{alertas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tarjetas de Líneas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {lineas.map((linea) => (
            <Card key={linea.id} className={getStatusColor(linea.status)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>{getStatusIcon(linea.status)}</span>
                  <span>{linea.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <p className="text-sm">
                    <span className="font-medium">Estado:</span> {getStatusText(linea.status)}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">OFs activas:</span> {linea.ofs_activas}/{linea.capacity}
                  </p>
                  
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">Ocupación</span>
                      <span className="font-medium">{Math.round((linea.ofs_activas / linea.capacity) * 100)}%</span>
                    </div>
                    <Progress value={(linea.ofs_activas / linea.capacity) * 100} className="h-2" />
                  </div>
                  
                  <p className="text-sm">
                    <span className="font-medium">Tiempo promedio:</span> {linea.tiempo_promedio}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Última actualización: hace 2 minutos
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => navigate(`/dashboard/produccion/linea/${linea.id}`)}
                    size="sm"
                  >
                    <Map className="mr-2 h-4 w-4" />
                    Ver Detalles
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedLineForAssignment(linea.id);
                      setIsCreateOFModalOpen(true);
                    }}
                    variant="default"
                    size="sm"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Asignar OF
                  </Button>
                  <Button
                    onClick={() => navigate("/dashboard/produccion/alertas")}
                    variant="outline"
                    size="sm"
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Alertas
                    {priorityAlerts.filter(a => 
                      a.related_of_id && recentOFs.find(of => 
                        of.id === a.related_of_id && of.line_id === linea.id
                      )
                    ).length > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {priorityAlerts.filter(a => 
                          a.related_of_id && recentOFs.find(of => 
                            of.id === a.related_of_id && of.line_id === linea.id
                          )
                        ).length}
                      </Badge>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <OFFilters 
          onFilterChange={(f) => {
            setFilters(f);
          }}
          lines={lineas}
        />

        {/* Tabla de OFs Recientes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Órdenes de Fabricación Recientes</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowAllOFs(!showAllOFs)}>
                {showAllOFs ? 'Ver menos' : 'Ver todas'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID SAP</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Línea</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOFs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No hay órdenes de fabricación
                    </TableCell>
                  </TableRow>
                ) : (
                  recentOFs.map((of) => (
                    <TableRow 
                      key={of.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/dashboard/produccion/of/${of.id}`)}
                    >
                      <TableCell className="font-mono">
                        #{of.sap_id || of.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{of.customer}</TableCell>
                      <TableCell>
                        {of.production_lines ? of.production_lines.name : 'Sin asignar'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          of.status === 'completada' ? 'default' :
                          of.status === 'en_proceso' ? 'secondary' :
                          of.status === 'validada' ? 'outline' :
                          'outline'
                        }>
                          {of.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={of.priority > 5 ? 'destructive' : of.priority > 2 ? 'default' : 'secondary'}>
                          {of.priority > 5 ? '🔴 ALTA' : of.priority > 2 ? '🟡 NORMAL' : '🟢 BAJA'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(of.created_at).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/produccion/of/${of.id}`);
                          }}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Gráfico de Tendencia */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Productividad</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={produccionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dia" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="completadas" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  name="Completadas"
                />
                <Line 
                  type="monotone" 
                  dataKey="pendientes" 
                  stroke="hsl(var(--warning))" 
                  strokeWidth={2}
                  name="Pendientes"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Panel de Alertas Prioritarias */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>⚠️ Alertas Prioritarias</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/dashboard/produccion/alertas')}
              >
                Ver Todas ({alertas})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {priorityAlerts.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                ✅ No hay alertas activas
              </p>
            ) : (
              <div className="space-y-2">
                {priorityAlerts.map((alert) => (
                  <Card 
                    key={alert.id} 
                    className={`p-3 cursor-pointer hover:bg-muted/50 border-l-4 ${
                      alert.severity === 'critical' ? 'border-destructive' :
                      alert.severity === 'warning' ? 'border-warning' :
                      'border-blue-500'
                    }`}
                    onClick={() => navigate('/dashboard/produccion/alertas')}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xl">
                        {alert.severity === 'critical' ? '🔴' :
                         alert.severity === 'warning' ? '🟡' : '🔵'}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(alert.created_at).toLocaleString('es-ES')} • {alert.type.replace('_', ' ').toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acciones Rápidas */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button className="h-auto py-4" onClick={() => setIsCreateOFModalOpen(true)}>
                <Plus className="mr-2 h-5 w-5" />
                Nueva OF
              </Button>
              <Button className="h-auto py-4" variant="outline">
                <Map className="mr-2 h-5 w-5" />
                Naves Digitales
              </Button>
              <Button className="h-auto py-4" variant="outline" onClick={() => navigate("/dashboard/produccion/alertas")}>
                <AlertTriangle className="mr-2 h-5 w-5" />
                Ver Alertas
              </Button>
              <Button 
                className="h-auto py-4" 
                variant="outline"
                onClick={() => setIsCredentialsModalOpen(true)}
              >
                <Key className="mr-2 h-5 w-5" />
                Generar Credenciales
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Modals */}
        <GenerateCredentialsModal
          open={isCredentialsModalOpen}
          onOpenChange={setIsCredentialsModalOpen}
          users={users}
        />
        <CreateOFModal
          isOpen={isCreateOFModalOpen}
          onClose={() => {
            setIsCreateOFModalOpen(false);
            setSelectedLineForAssignment(null);
          }}
          onSuccess={fetchDashboardData}
        />
      </div>
    </div>
  );
};

export default DashboardProduccion;
