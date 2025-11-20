import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Bell, ArrowLeft, Package2 } from "lucide-react";
import { toast } from "sonner";

interface OrderSummary {
  pedido_comercial: string;
  customer: string;
  fecha_creacion: string;
  total_ofs: number;
  completed_ofs: number;
  in_progress_ofs: number;
  pending_ofs: number;
}

const DashboardProduccion = () => {
  const { user, hasRole, signOut } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [allOFs, setAllOFs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ 
    status: 'all', 
    customer: '', 
    line: 'all',
    pedido: '',
    fecha_desde: '',
    fecha_hasta: ''
  });
  const [productionLines, setProductionLines] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    // Acceso permitido para: admin_global, admin_departamento, supervisor, operario, quality
    fetchOrdersData();
    setupRealtimeSubscriptions();
  }, [user, filters]);

  const fetchOrdersData = async () => {
    try {
      setLoading(true);
      
      // Obtener líneas de producción primero
      const { data: productionLinesData } = await supabase
        .from('production_lines')
        .select('id, name');
      
      setProductionLines(productionLinesData || []);
      const linesMap = new Map(productionLinesData?.map(line => [line.id, line.name]));
      
      // Consulta de OFs sin JOIN
      let query = supabase
        .from('fabrication_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.status !== 'all' && filters.status) {
        const statusValue = filters.status as 'pendiente' | 'en_proceso' | 'completada' | 'validada' | 'albarana';
        query = query.eq('status', statusValue);
      }
      if (filters.customer) {
        query = query.ilike('customer', `%${filters.customer}%`);
      }
      if (filters.pedido) {
        query = query.ilike('pedido_comercial', `%${filters.pedido}%`);
      }
      if (filters.fecha_desde) {
        query = query.gte('fecha_creacion_pedido', filters.fecha_desde);
      }
      if (filters.fecha_hasta) {
        query = query.lte('fecha_creacion_pedido', filters.fecha_hasta);
      }
      if (filters.line !== 'all') {
        if (filters.line === 'sin_asignar') {
          query = query.is('line_id', null);
        } else {
          query = query.eq('line_id', filters.line);
        }
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Mapear nombre de línea a cada OF
      const dataWithLines = data?.map(of => ({
        ...of,
        line_name: of.line_id ? linesMap.get(of.line_id) : null
      }));
      
      setAllOFs(dataWithLines || []);

      // Agrupar por PEDIDO COMERCIAL (no por cliente)
      const ordersByPedido = new Map<string, OrderSummary>();
      
      data?.forEach((of: any) => {
        const pedido = of.pedido_comercial || 'Sin pedido';
        
        if (!ordersByPedido.has(pedido)) {
          ordersByPedido.set(pedido, {
            pedido_comercial: pedido,
            customer: of.customer || 'Sin cliente',
            fecha_creacion: of.fecha_creacion_pedido || of.created_at,
            total_ofs: 0,
            completed_ofs: 0,
            in_progress_ofs: 0,
            pending_ofs: 0
          });
        }
        
        const summary = ordersByPedido.get(pedido)!;
        summary.total_ofs++;
        
        if (['completada', 'validada', 'albarana'].includes(of.status)) {
          summary.completed_ofs++;
        } else if (of.status === 'en_proceso') {
          summary.in_progress_ofs++;
        } else {
          summary.pending_ofs++;
        }
      });

      setOrders(Array.from(ordersByPedido.values()).sort((a, b) => {
        // Ordenar por fecha de creación (más recientes primero)
        return new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime();
      }));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Error al cargar órdenes');
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel('fabrication-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fabrication_orders'
        },
        () => {
          fetchOrdersData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getStatusVariant = (status: string) => {
    switch(status) {
      case 'completada':
      case 'validada':
      case 'albarana':
        return 'default';
      case 'en_proceso': return 'secondary';
      case 'pendiente': return 'outline';
      default: return 'outline';
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {hasRole('admin_global') && (
              <Button variant="ghost" onClick={() => navigate('/dashboard/global')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Dashboard Global
              </Button>
            )}
            <h1 className="text-3xl font-bold">Dashboard Producción</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/dashboard/produccion/alertas")}>
              <Bell className="mr-2 h-4 w-4" />
              Alertas
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              Cerrar Sesión
            </Button>
          </div>
        </div>

        {/* Estadísticas generales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total OFs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allOFs.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {allOFs.filter(of => ['completada', 'validada', 'albarana'].includes(of.status)).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">En Proceso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {allOFs.filter(of => of.status === 'en_proceso').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {allOFs.filter(of => of.status === 'pendiente').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Fila 1 */}
              <Input 
                placeholder="Buscar por nº pedido..." 
                value={filters.pedido}
                onChange={(e) => setFilters({...filters, pedido: e.target.value})} 
              />
              <Input 
                placeholder="Buscar cliente..." 
                value={filters.customer}
                onChange={(e) => setFilters({...filters, customer: e.target.value})} 
              />
              <Select 
                value={filters.line} 
                onValueChange={(val) => setFilters({...filters, line: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Línea de producción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las líneas</SelectItem>
                  <SelectItem value="sin_asignar">Sin asignar</SelectItem>
                  {productionLines.map(line => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Fila 2 */}
              <Select 
                value={filters.status} 
                onValueChange={(val) => setFilters({...filters, status: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_proceso">En Proceso</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                  <SelectItem value="validada">Validada</SelectItem>
                  <SelectItem value="albarana">Albaranada</SelectItem>
                </SelectContent>
              </Select>
              <div>
                <Input 
                  type="date"
                  placeholder="Fecha desde" 
                  value={filters.fecha_desde}
                  onChange={(e) => setFilters({...filters, fecha_desde: e.target.value})}
                />
              </div>
              <div>
                <Input 
                  type="date"
                  placeholder="Fecha hasta" 
                  value={filters.fecha_hasta}
                  onChange={(e) => setFilters({...filters, fecha_hasta: e.target.value})}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Pedidos */}
        <Card>
          <CardHeader>
            <CardTitle>Pedidos Comerciales</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron pedidos
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Total OFs</TableHead>
                    <TableHead>Completadas</TableHead>
                    <TableHead>En Proceso</TableHead>
                    <TableHead>Pendientes</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono font-bold">{order.pedido_comercial}</TableCell>
                      <TableCell>{order.customer}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(order.fecha_creacion).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell>{order.total_ofs}</TableCell>
                      <TableCell className="text-green-600 font-semibold">
                        {order.completed_ofs}
                      </TableCell>
                      <TableCell className="text-blue-600 font-semibold">
                        {order.in_progress_ofs}
                      </TableCell>
                      <TableCell className="text-orange-600 font-semibold">
                        {order.pending_ofs}
                      </TableCell>
                      <TableCell>
                        <div className="w-full max-w-xs">
                          <Progress 
                            value={order.total_ofs > 0 ? (order.completed_ofs / order.total_ofs) * 100 : 0} 
                          />
                          <span className="text-xs text-muted-foreground mt-1">
                            {order.total_ofs > 0 
                              ? Math.round((order.completed_ofs / order.total_ofs) * 100) 
                              : 0}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          onClick={() => {
                            // Obtener el primer OF de este pedido para usar como pedidoId
                            const firstOF = allOFs.find(of => of.pedido_comercial === order.pedido_comercial);
                            if (firstOF) {
                              navigate(`/dashboard/produccion/pedido/${firstOF.id}`);
                            }
                          }}
                        >
                          <Package2 className="mr-2 h-4 w-4" />
                          Ver Pedido
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardProduccion;
