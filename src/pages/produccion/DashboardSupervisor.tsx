import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Factory, CheckCircle, AlertTriangle, Users, Clock, Activity, 
  AlertCircle, TrendingUp, RefreshCw, Crown, LogOut
} from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Metrics {
  total_active_ofs: number;
  new_today: number;
  completed_today: number;
  completion_rate: number;
  critical_alerts: number;
  active_employees: number;
  avg_completion_hours: number;
  capacity_used: number;
  delayed_ofs: number;
  efficiency: number;
  efficiency_trend: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const DashboardSupervisor = () => {
  const { user, hasRole, signOut } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [allOFs, setAllOFs] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dailyProduction, setDailyProduction] = useState<any[]>([]);
  const [ofsByStatus, setOfsByStatus] = useState<any[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
  const [criticalAlerts, setCriticalAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ACCESO TEMPORAL DESACTIVADO PARA PRESENTACIÓN
    // Verificar permisos
    // const allowedRoles = ['admin_global', 'admin_departamento', 'supervisor'];
    // const hasPermission = allowedRoles.some(role => hasRole(role as any));
    
    // if (!user || !hasPermission) {
    //   toast.error('No tienes permisos para acceder a este dashboard');
    //   navigate('/dashboard/produccion');
    //   return;
    // }

    if (!user) {
      navigate('/auth');
      return;
    }

    fetchAllData();
    setupRealtimeSubscriptions();
  }, [user, hasRole, navigate]);

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel('supervisor-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fabrication_orders' }, () => {
        fetchAllData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        fetchCriticalAlerts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_steps' }, () => {
        fetchActiveEmployees();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchMetrics(),
      fetchAllOFs(),
      fetchDailyProduction(),
      fetchOFsByStatus(),
      fetchActiveEmployees(),
      fetchCriticalAlerts()
    ]);
    setLoading(false);
  };

  const fetchMetrics = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      
      // Total OFs activas
      const { count: totalActive } = await supabase
        .from('fabrication_orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pendiente', 'en_proceso']);

      // OFs creadas hoy
      const { count: newToday } = await supabase
        .from('fabrication_orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .lte('created_at', todayEnd.toISOString());

      // OFs completadas hoy - consultas separadas por status
      const completedTodayPromises = ['completada', 'validada', 'albarana'].map(status =>
        supabase
          .from('fabrication_orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', status)
          .not('completed_at', 'is', null)
          .gte('completed_at', today.toISOString())
          .lte('completed_at', todayEnd.toISOString())
      );
      
      const completedTodayResults = await Promise.all(completedTodayPromises);
      const completedToday = completedTodayResults.reduce((sum, result) => sum + (result.count || 0), 0);

      // Alertas críticas
      const { count: criticalCount } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .is('resolved_at', null)
        .eq('severity', 'critical');

      // Empleados activos
      const { data: activeSteps } = await supabase
        .from('production_steps')
        .select('assigned_to')
        .eq('status', 'en_proceso')
        .not('assigned_to', 'is', null);

      const uniqueEmployees = new Set(activeSteps?.map(s => s.assigned_to)).size;

      // Tiempo promedio de completación (últimos 30 días)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: completedOFs } = await supabase
        .from('fabrication_orders')
        .select('created_at, completed_at')
        .not('completed_at', 'is', null)
        .gte('completed_at', thirtyDaysAgo.toISOString());

      let avgHours = 0;
      if (completedOFs && completedOFs.length > 0) {
        const totalHours = completedOFs.reduce((sum, of) => {
          const diff = new Date(of.completed_at!).getTime() - new Date(of.created_at).getTime();
          return sum + (diff / (1000 * 60 * 60));
        }, 0);
        avgHours = Math.round((totalHours / completedOFs.length) * 10) / 10;
      }

      // Capacidad utilizada
      const { data: lines } = await supabase.from('production_lines').select('id');
      const { data: activeLines } = await supabase
        .from('fabrication_orders')
        .select('line_id')
        .in('status', ['pendiente', 'en_proceso'])
        .not('line_id', 'is', null);

      const uniqueLines = new Set(activeLines?.map(of => of.line_id)).size;
      const capacityUsed = lines && lines.length > 0 
        ? Math.round((uniqueLines / lines.length) * 100) 
        : 0;

      // OFs atrasadas (más de 48h en proceso)
      const twoDaysAgo = new Date();
      twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
      
      const { count: delayedCount } = await supabase
        .from('fabrication_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'en_proceso')
        .not('started_at', 'is', null)
        .lt('started_at', twoDaysAgo.toISOString());

      // Eficiencia semanal - consultas separadas por status
      const thisWeekStart = new Date();
      thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
      thisWeekStart.setHours(0, 0, 0, 0);

      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      const thisWeekPromises = ['completada', 'validada', 'albarana'].map(status =>
        supabase
          .from('fabrication_orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', status)
          .not('completed_at', 'is', null)
          .gte('completed_at', thisWeekStart.toISOString())
      );

      const lastWeekPromises = ['completada', 'validada', 'albarana'].map(status =>
        supabase
          .from('fabrication_orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', status)
          .not('completed_at', 'is', null)
          .gte('completed_at', lastWeekStart.toISOString())
          .lt('completed_at', thisWeekStart.toISOString())
      );

      const thisWeekResults = await Promise.all(thisWeekPromises);
      const lastWeekResults = await Promise.all(lastWeekPromises);

      const thisWeekCompleted = thisWeekResults.reduce((sum, result) => sum + (result.count || 0), 0);
      const lastWeekCompleted = lastWeekResults.reduce((sum, result) => sum + (result.count || 0), 0);

      const efficiency = lastWeekCompleted > 0
        ? Math.round((thisWeekCompleted / lastWeekCompleted) * 100)
        : 100;

      const efficiencyTrend = lastWeekCompleted > 0
        ? Math.round(((thisWeekCompleted - lastWeekCompleted) / lastWeekCompleted) * 100)
        : 0;

      const completionRate = newToday && newToday > 0
        ? Math.round((completedToday / newToday) * 100)
        : 0;

      setMetrics({
        total_active_ofs: totalActive || 0,
        new_today: newToday || 0,
        completed_today: completedToday,
        completion_rate: completionRate,
        critical_alerts: criticalCount || 0,
        active_employees: uniqueEmployees,
        avg_completion_hours: avgHours,
        capacity_used: capacityUsed,
        delayed_ofs: delayedCount || 0,
        efficiency: efficiency,
        efficiency_trend: efficiencyTrend
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Error al cargar métricas');
    }
  };

  const fetchAllOFs = async () => {
    try {
      let query = supabase
        .from('fabrication_orders')
        .select(`
          id,
          sap_id,
          customer,
          status,
          priority,
          created_at,
          started_at,
          completed_at,
          line_id,
          production_lines (name),
          assignee:assignee_id (id, name:profiles(name))
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAllOFs(data || []);
    } catch (error) {
      console.error('Error fetching OFs:', error);
      toast.error('Error al cargar órdenes de fabricación');
    }
  };

  const fetchDailyProduction = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: created } = await supabase
        .from('fabrication_orders')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { data: completed } = await supabase
        .from('fabrication_orders')
        .select('completed_at')
        .not('completed_at', 'is', null)
        .gte('completed_at', thirtyDaysAgo.toISOString());

      const dailyData: { [key: string]: { created: number; completed: number } } = {};

      created?.forEach(of => {
        const date = new Date(of.created_at).toISOString().split('T')[0];
        if (!dailyData[date]) dailyData[date] = { created: 0, completed: 0 };
        dailyData[date].created++;
      });

      completed?.forEach(of => {
        const date = new Date(of.completed_at!).toISOString().split('T')[0];
        if (!dailyData[date]) dailyData[date] = { created: 0, completed: 0 };
        dailyData[date].completed++;
      });

      const chartData = Object.entries(dailyData)
        .map(([date, counts]) => ({
          date: new Date(date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
          created: counts.created,
          completed: counts.completed
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-30);

      setDailyProduction(chartData);
    } catch (error) {
      console.error('Error fetching daily production:', error);
    }
  };

  const fetchOFsByStatus = async () => {
    try {
      const statuses: Array<'pendiente' | 'en_proceso' | 'completada' | 'validada' | 'albarana'> = 
        ['pendiente', 'en_proceso', 'completada', 'validada', 'albarana'];
      
      const statusData = await Promise.all(
        statuses.map(async (status) => {
          const { count } = await supabase
            .from('fabrication_orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', status);
          
          return {
            name: status.replace('_', ' ').toUpperCase(),
            count: count || 0
          };
        })
      );

      setOfsByStatus(statusData.filter(s => s.count > 0));
    } catch (error) {
      console.error('Error fetching OFs by status:', error);
    }
  };

  const fetchActiveEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('production_steps')
        .select(`
          id,
          step_name,
          status,
          started_at,
          assigned_to,
          profiles:assigned_to (name),
          fabrication_orders:of_id (sap_id, customer)
        `)
        .eq('status', 'en_proceso')
        .not('assigned_to', 'is', null)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setActiveEmployees(data || []);
    } catch (error) {
      console.error('Error fetching active employees:', error);
    }
  };

  const fetchCriticalAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select(`
          *,
          fabrication_orders:related_of_id (sap_id, customer)
        `)
        .is('resolved_at', null)
        .eq('severity', 'critical')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setCriticalAlerts(data || []);
    } catch (error) {
      console.error('Error fetching critical alerts:', error);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ 
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id 
        })
        .eq('id', alertId);

      if (error) throw error;
      
      toast.success('Alerta resuelta');
      fetchCriticalAlerts();
      fetchMetrics();
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Error al resolver alerta');
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      pendiente: "secondary",
      en_proceso: "default",
      completada: "outline",
      validada: "outline",
      albaranada: "outline"
    };
    return variants[status] || "default";
  };

  const calculateElapsedTime = (createdAt: string, completedAt: string | null) => {
    const start = new Date(createdAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffHours = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 24) return `${diffHours}h`;
    const days = Math.floor(diffHours / 24);
    return `${days}d ${diffHours % 24}h`;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-lg mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Dashboard Supervisor</h1>
            </div>
            <p className="text-blue-100">
              Bienvenido, {user?.user_metadata?.name || user?.email}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-blue-200">Última actualización</p>
              <p className="text-lg font-semibold">
                {new Date().toLocaleString('es-ES')}
              </p>
            </div>
            <Button variant="secondary" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total OFs Activas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">OFs Activas</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_active_ofs || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{metrics?.new_today || 0} creadas hoy
            </p>
          </CardContent>
        </Card>

        {/* Completadas Hoy */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completadas Hoy</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics?.completed_today || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.completion_rate}% tasa de éxito
            </p>
          </CardContent>
        </Card>

        {/* Alertas Críticas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alertas Críticas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {metrics?.critical_alerts || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requieren atención inmediata
            </p>
          </CardContent>
        </Card>

        {/* Empleados Activos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Empleados Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.active_employees || 0}</div>
            <p className="text-xs text-muted-foreground">Trabajando ahora</p>
          </CardContent>
        </Card>

        {/* Tiempo Promedio */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.avg_completion_hours || 0}h
            </div>
            <p className="text-xs text-muted-foreground">Por orden completada</p>
          </CardContent>
        </Card>

        {/* Capacidad */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Capacidad</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.capacity_used || 0}%</div>
            <Progress value={metrics?.capacity_used || 0} className="mt-2" />
          </CardContent>
        </Card>

        {/* OFs Atrasadas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">OFs Atrasadas</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {metrics?.delayed_ofs || 0}
            </div>
            <p className="text-xs text-muted-foreground">Requieren seguimiento</p>
          </CardContent>
        </Card>

        {/* Eficiencia Global */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Eficiencia Global</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics?.efficiency || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.efficiency_trend >= 0 ? '+' : ''}{metrics?.efficiency_trend}% vs semana pasada
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas Críticas */}
      {criticalAlerts.length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertas Críticas Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalAlerts.map((alert) => (
              <div key={alert.id} className="p-4 bg-white border-l-4 border-red-500 rounded">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-red-700">{alert.message}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      OF: {alert.fabrication_orders?.sap_id || 'N/A'} - {alert.fabrication_orders?.customer || 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(alert.created_at).toLocaleString('es-ES')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => resolveAlert(alert.id)}
                  >
                    Resolver
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabla de OFs */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Todas las Órdenes de Fabricación</CardTitle>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                fetchAllOFs();
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_proceso">En Proceso</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                  <SelectItem value="validada">Validada</SelectItem>
                  <SelectItem value="albarana">Albarana</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchAllData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SAP ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Línea</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Asignado a</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead>Tiempo Transcurrido</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allOFs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No hay órdenes de fabricación
                    </TableCell>
                  </TableRow>
                ) : (
                  allOFs.map((of) => (
                    <TableRow key={of.id}>
                      <TableCell className="font-mono">
                        #{of.sap_id || of.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-medium">{of.customer}</TableCell>
                      <TableCell>
                        {of.production_lines?.name || 'Sin asignar'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(of.status)}>
                          {of.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={(of.priority || 0) > 5 ? 'destructive' : 'default'}>
                          {(of.priority || 0) > 5 ? '🔴 ALTA' : '🟢 NORMAL'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {of.assignee?.profiles?.name || 'Sin asignar'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(of.created_at).toLocaleString('es-ES')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {calculateElapsedTime(of.created_at, of.completed_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/dashboard/produccion/of/${of.id}`)}
                        >
                          Ver Detalles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Producción Diaria */}
        <Card>
          <CardHeader>
            <CardTitle>Producción de los Últimos 30 Días</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyProduction}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="created" fill="#3b82f6" name="Creadas" />
                <Bar dataKey="completed" fill="#10b981" name="Completadas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribución por Estado */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de OFs por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={ofsByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.name}: ${entry.count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {ofsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Empleados Activos */}
      {activeEmployees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Empleados Trabajando Ahora</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeEmployees.map((task) => (
                <div key={task.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Avatar>
                    <AvatarFallback>
                      {task.profiles?.name?.charAt(0) || 'E'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{task.profiles?.name || 'Empleado'}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.step_name} - OF #{task.fabrication_orders?.sap_id || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">En Proceso</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Desde {new Date(task.started_at).toLocaleTimeString('es-ES')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardSupervisor;
