import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/rrhh/MetricCard';
import { Users, AlertTriangle, Calendar, FileWarning, Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const DashboardRRHH = () => {
  const { user, userRoles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Estados
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    empleadosPresentes: 0,
    empleadosTotales: 0,
    fichajesPendientes: 0,
    ausenciasHoy: 0,
    documentosCaducados: 0
  });

  useEffect(() => {
    if (!user) return;
    
    // Acceso permitido para: admin_global, admin_departamento
    // Similar al patrón de producción
    
    loadMetrics();
    setupRealtimeSubscriptions();
  }, [user]);

  const loadMetrics = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Empleados activos
      const { count: totalEmpleados } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);

      // Fichajes completos hoy
      const { count: presentes } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .gte('check_in', `${today}T00:00:00`)
        .lte('check_in', `${today}T23:59:59`)
        .eq('status', 'completo');

      // Fichajes pendientes hoy
      const { count: pendientes } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .gte('check_in', `${today}T00:00:00`)
        .lte('check_in', `${today}T23:59:59`)
        .eq('status', 'pendiente');

      // Ausencias hoy
      const { count: ausencias } = await supabase
        .from('absences')
        .select('*', { count: 'exact', head: true })
        .lte('start_date', today)
        .gte('end_date', today)
        .eq('status', 'aprobado');

      // Documentos caducados
      const { count: docsVencidos } = await supabase
        .from('employee_documents')
        .select('*', { count: 'exact', head: true })
        .lt('expiry_date', today)
        .eq('required', true);

      setMetrics({
        empleadosPresentes: presentes || 0,
        empleadosTotales: totalEmpleados || 0,
        fichajesPendientes: pendientes || 0,
        ausenciasHoy: ausencias || 0,
        documentosCaducados: docsVencidos || 0
      });

      setLoading(false);
    } catch (error) {
      console.error('Error cargando métricas:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las métricas',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel('rrhh-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        () => loadMetrics()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => loadMetrics()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'absences' },
        () => loadMetrics()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employee_documents' },
        () => loadMetrics()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  if (authLoading || loading) {
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
            <h1 className="text-3xl font-bold text-foreground">Dashboard RRHH</h1>
            <p className="text-muted-foreground mt-1">
              Gestión de Recursos Humanos - Bienvenido, {user?.email}
            </p>
          </div>
          <Button onClick={() => navigate('/')} variant="outline">
            Volver al inicio
          </Button>
        </div>

        {/* Métricas Globales */}
        <Card>
          <CardHeader>
            <CardTitle>Estado del Sistema RRHH</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Empleados Totales</p>
                <p className="text-2xl font-bold text-foreground">{metrics.empleadosTotales}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Presentes Hoy</p>
                <p className="text-2xl font-bold text-success">{metrics.empleadosPresentes}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fichajes Pendientes</p>
                <p className="text-2xl font-bold text-warning">{metrics.fichajesPendientes}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ausencias Hoy</p>
                <p className="text-2xl font-bold text-info">{metrics.ausenciasHoy}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Docs Caducados</p>
                <p className="text-2xl font-bold text-destructive">{metrics.documentosCaducados}</p>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Métricas del día */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Empleados Presentes"
          value={`${metrics.empleadosPresentes}/${metrics.empleadosTotales}`}
          icon={Users}
          color="green"
          onClick={() => navigate('/dashboard/rrhh/fichajes')}
        />
        
        <MetricCard
          title="Fichajes Pendientes"
          value={metrics.fichajesPendientes}
          icon={AlertTriangle}
          color={metrics.fichajesPendientes > 0 ? 'red' : 'gray'}
          onClick={() => navigate('/dashboard/rrhh/fichajes')}
        />
        
        <MetricCard
          title="Ausencias Hoy"
          value={metrics.ausenciasHoy}
          icon={Calendar}
          color="blue"
          onClick={() => navigate('/dashboard/rrhh/ausencias')}
        />
        
        <MetricCard
          title="Docs Caducados"
          value={metrics.documentosCaducados}
          icon={FileWarning}
          color={metrics.documentosCaducados > 0 ? 'orange' : 'gray'}
          onClick={() => navigate('/dashboard/rrhh/documentacion')}
        />
      </div>

      {/* Accesos rápidos */}
        <Card>
          <CardHeader>
            <CardTitle>Módulos RRHH</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button
                className="h-auto py-6 flex-col items-start"
                variant="outline"
                onClick={() => navigate('/dashboard/rrhh/empleados')}
              >
                <Users className="mb-2 h-6 w-6" />
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Empleados</h3>
                  <p className="text-sm text-muted-foreground">Gestión de personal</p>
                </div>
              </Button>
              
              <Button
                className="h-auto py-6 flex-col items-start"
                variant="outline"
                onClick={() => navigate('/dashboard/rrhh/fichajes')}
              >
                <Calendar className="mb-2 h-6 w-6" />
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Fichajes</h3>
                  <p className="text-sm text-muted-foreground">Control horario</p>
                </div>
              </Button>
              
              <Button
                className="h-auto py-6 flex-col items-start"
                variant="outline"
                onClick={() => navigate('/dashboard/rrhh/turnos')}
              >
                <Calendar className="mb-2 h-6 w-6" />
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Turnos</h3>
                  <p className="text-sm text-muted-foreground">Planificación turnos</p>
                </div>
              </Button>
              
              <Button
                className="h-auto py-6 flex-col items-start"
                variant="outline"
                onClick={() => navigate('/dashboard/rrhh/nominas')}
              >
                <FileWarning className="mb-2 h-6 w-6" />
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Nóminas</h3>
                  <p className="text-sm text-muted-foreground">Validación nóminas</p>
                </div>
              </Button>

              <Button
                className="h-auto py-6 flex-col items-start"
                variant="outline"
                onClick={() => navigate('/dashboard/rrhh/ausencias')}
              >
                <AlertTriangle className="mb-2 h-6 w-6" />
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Ausencias</h3>
                  <p className="text-sm text-muted-foreground">Vacaciones y bajas</p>
                </div>
              </Button>

              <Button
                className="h-auto py-6 flex-col items-start"
                variant="outline"
                onClick={() => navigate('/dashboard/rrhh/documentacion')}
              >
                <FileWarning className="mb-2 h-6 w-6" />
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Documentación</h3>
                  <p className="text-sm text-muted-foreground">Gestión documentos</p>
                </div>
              </Button>

              <Button
                className="h-auto py-6 flex-col items-start"
                variant="outline"
                onClick={() => navigate('/dashboard/rrhh/empleados-ett')}
              >
                <Users className="mb-2 h-6 w-6" />
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Empleados ETT</h3>
                  <p className="text-sm text-muted-foreground">Gestión ETT</p>
                </div>
              </Button>

              <Button
                className="h-auto py-6 flex-col items-start"
                onClick={() => navigate('/dashboard/rrhh/empleados')}
              >
                <Plus className="mb-2 h-6 w-6" />
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Nuevo Empleado</h3>
                  <p className="text-sm text-muted-foreground">Alta personal</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
