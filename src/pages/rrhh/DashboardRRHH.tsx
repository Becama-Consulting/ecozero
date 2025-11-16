import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/rrhh/MetricCard';
import { Users, AlertTriangle, Calendar, FileWarning } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const DashboardRRHH = () => {
  const { user, userRoles, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Estados
  const [metrics, setMetrics] = useState({
    empleadosPresentes: 0,
    empleadosTotales: 0,
    fichajesPendientes: 0,
    ausenciasHoy: 0,
    documentosCaducados: 0
  });

  // Verificar permisos
  useEffect(() => {
    if (!loading && user) {
      const hasAccess = userRoles.some(r => 
        r.role === 'admin_global' || 
        r.role === 'admin_departamento' ||
        r.role === 'rrhh'
      );
      
      if (!hasAccess) {
        navigate('/');
      }
    }
  }, [loading, user, userRoles, navigate]);

  // Cargar métricas
  useEffect(() => {
    if (!loading && user) {
      loadMetrics();
    }
  }, [loading, user]);

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
    } catch (error) {
      console.error('Error cargando métricas:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las métricas',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard RRHH</h1>
        <p className="text-muted-foreground">
          Gestión de Recursos Humanos - EcoZero
        </p>
      </div>

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/dashboard/rrhh/empleados')}
        >
          <h3 className="font-semibold text-lg">Empleados</h3>
          <p className="text-sm text-muted-foreground">Gestión de personal</p>
        </Card>
        
        <Card 
          className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/dashboard/rrhh/fichajes')}
        >
          <h3 className="font-semibold text-lg">Fichajes</h3>
          <p className="text-sm text-muted-foreground">Control horario</p>
        </Card>
        
        <Card 
          className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/dashboard/rrhh/turnos')}
        >
          <h3 className="font-semibold text-lg">Turnos</h3>
          <p className="text-sm text-muted-foreground">Planificación turnos</p>
        </Card>
        
        <Card 
          className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/dashboard/rrhh/nominas')}
        >
          <h3 className="font-semibold text-lg">Nóminas</h3>
          <p className="text-sm text-muted-foreground">Validación nóminas</p>
        </Card>
      </div>
    </div>
  );
};
