import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Warehouse, Activity, AlertTriangle, TrendingUp, RefreshCw, Zap } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ProductionLine {
  id: string;
  name: string;
  capacity: number;
  status: string;
  current_occupancy?: number;
}

interface FabricationOrder {
  id: string;
  sap_id: string;
  customer: string;
  status: string;
  priority: number;
  line_id: string | null;
  created_at: string;
}

interface AssignmentResult {
  success: boolean;
  assigned_warehouse?: {
    id: string;
    name: string;
    occupancy: number;
    capacity: number;
    score: number;
  };
  all_warehouses?: Array<{
    id: string;
    name: string;
    occupancy: number;
    capacity: number;
    occupancy_rate: string;
  }>;
  alerts?: Array<{
    warehouse: string;
    occupancy: number;
    capacity: number;
    rate: string;
  }>;
  error?: string;
  bottleneck?: boolean;
}

export default function GestionNaves() {
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<FabricationOrder[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<FabricationOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    setupRealtimeSubscriptions();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Obtener líneas de producción (naves)
      const { data: linesData, error: linesError } = await supabase
        .from('production_lines')
        .select('*')
        .order('name');

      if (linesError) throw linesError;

      // Calcular ocupación para cada nave
      const linesWithOccupancy = await Promise.all(
        (linesData || []).map(async (line) => {
          const { count } = await supabase
            .from('fabrication_orders')
            .select('*', { count: 'exact', head: true })
            .eq('line_id', line.id)
            .in('status', ['pendiente', 'en_proceso']);

          return {
            ...line,
            current_occupancy: count || 0,
          };
        })
      );

      setLines(linesWithOccupancy);

      // Obtener órdenes sin asignar
      const { data: unassigned, error: unassignedError } = await supabase
        .from('fabrication_orders')
        .select('*')
        .is('line_id', null)
        .in('status', ['pendiente'])
        .order('priority', { ascending: false })
        .limit(10);

      if (unassignedError) throw unassignedError;
      setUnassignedOrders(unassigned || []);

      // Obtener asignaciones recientes
      const { data: recent, error: recentError } = await supabase
        .from('fabrication_orders')
        .select('*')
        .not('line_id', 'is', null)
        .in('status', ['pendiente', 'en_proceso'])
        .order('updated_at', { ascending: false })
        .limit(10);

      if (recentError) throw recentError;
      setRecentAssignments(recent || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel('gestion-naves-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fabrication_orders',
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_lines',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const assignWarehouse = async (ofId: string, priority: number = 0) => {
    setAssigning(true);
    try {
      const { data, error } = await supabase.functions.invoke('assign-warehouse', {
        body: {
          of_id: ofId,
          priority,
          material_type: 'corte',
          estimated_hours: 4,
        },
      });

      if (error) throw error;

      const result = data as AssignmentResult;

      if (!result.success) {
        if (result.bottleneck) {
          toast({
            title: '⚠️ Cuello de botella detectado',
            description: result.error || 'No hay capacidad disponible en las naves',
            variant: 'destructive',
          });
        } else {
          throw new Error(result.error || 'Error en la asignación');
        }
        return;
      }

      toast({
        title: '✅ Asignación exitosa',
        description: `OF asignada a ${result.assigned_warehouse?.name}`,
      });

      // Mostrar alertas de saturación si existen
      if (result.alerts && result.alerts.length > 0) {
        result.alerts.forEach((alert) => {
          toast({
            title: '⚠️ Alerta de saturación',
            description: `${alert.warehouse}: ${alert.rate}% ocupado (${alert.occupancy}/${alert.capacity})`,
            variant: 'destructive',
          });
        });
      }

      fetchData();
    } catch (error) {
      console.error('Error asignando nave:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo asignar la nave',
        variant: 'destructive',
      });
    } finally {
      setAssigning(false);
    }
  };

  const getOccupancyColor = (occupancy: number, capacity: number) => {
    const rate = (occupancy / capacity) * 100;
    if (rate >= 90) return 'text-destructive';
    if (rate >= 80) return 'text-orange-500';
    if (rate >= 60) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getOccupancyBadge = (occupancy: number, capacity: number) => {
    const rate = (occupancy / capacity) * 100;
    if (rate >= 90) return 'destructive';
    if (rate >= 80) return 'default';
    return 'secondary';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pendiente: 'secondary',
      en_proceso: 'default',
      completada: 'outline',
      validada: 'outline',
      albarana: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión Inteligente de Naves</h1>
          <p className="text-muted-foreground">
            Visualización en tiempo real y asignación automática
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Métricas de Naves */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {lines.map((line) => {
          const occupancyRate = ((line.current_occupancy || 0) / line.capacity) * 100;
          return (
            <Card key={line.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <Warehouse className="h-4 w-4 inline mr-2" />
                  {line.name}
                </CardTitle>
                <Badge variant={getOccupancyBadge(line.current_occupancy || 0, line.capacity)}>
                  {line.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <span className={getOccupancyColor(line.current_occupancy || 0, line.capacity)}>
                    {line.current_occupancy || 0}
                  </span>
                  <span className="text-muted-foreground text-sm">/{line.capacity}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ocupación: {occupancyRate.toFixed(1)}%
                </p>
                <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      occupancyRate >= 90
                        ? 'bg-destructive'
                        : occupancyRate >= 80
                        ? 'bg-orange-500'
                        : occupancyRate >= 60
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Órdenes Sin Asignar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Órdenes Pendientes de Asignación
            </CardTitle>
            <CardDescription>
              {unassignedOrders.length} órdenes esperando nave
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unassignedOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay órdenes pendientes de asignación
              </p>
            ) : (
              <div className="space-y-2">
                {unassignedOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {order.sap_id || order.id.substring(0, 8)}
                      </p>
                      <p className="text-sm text-muted-foreground">{order.customer}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(order.status)}
                        <Badge variant="outline">P: {order.priority}</Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => assignWarehouse(order.id, order.priority)}
                      disabled={assigning}
                    >
                      <Zap className="h-4 w-4 mr-1" />
                      Asignar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Asignaciones Recientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Asignaciones Recientes
            </CardTitle>
            <CardDescription>
              {recentAssignments.length} órdenes en curso
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay asignaciones recientes
              </p>
            ) : (
              <div className="space-y-2">
                {recentAssignments.slice(0, 8).map((order) => {
                  const assignedLine = lines.find((l) => l.id === order.line_id);
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {order.sap_id || order.id.substring(0, 8)}
                        </p>
                        <p className="text-sm text-muted-foreground">{order.customer}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{assignedLine?.name || 'N/A'}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getStatusBadge(order.status)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Métricas Adicionales */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Capacidad Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lines.reduce((acc, line) => acc + (line.current_occupancy || 0), 0)} /{' '}
              {lines.reduce((acc, line) => acc + line.capacity, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {(
                (lines.reduce((acc, line) => acc + (line.current_occupancy || 0), 0) /
                  lines.reduce((acc, line) => acc + line.capacity, 0)) *
                100
              ).toFixed(1)}
              % ocupado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Naves Saturadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                lines.filter(
                  (line) => ((line.current_occupancy || 0) / line.capacity) * 100 >= 80
                ).length
              }
            </div>
            <p className="text-xs text-muted-foreground">≥80% de ocupación</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin Asignar</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unassignedOrders.length}</div>
            <p className="text-xs text-muted-foreground">Órdenes pendientes</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
