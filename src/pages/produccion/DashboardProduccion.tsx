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
  customer: string;
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
  const [filters, setFilters] = useState({ status: 'all', customer: '' });

  useEffect(() => {
    if (!user) return;
    // Acceso permitido para: admin_global, admin_departamento, supervisor, operario, quality
    fetchOrdersData();
    setupRealtimeSubscriptions();
  }, [user, filters]);

  const fetchOrdersData = async () => {
    try {
      setLoading(true);
      
      // PRUEBA DIAGNÓSTICO: Consulta más simple posible
      console.log('🔍 Iniciando consulta...');
      const { data: testData, error: testError } = await supabase
        .from('fabrication_orders')
        .select('id, customer, status');
      
      console.log('🧪 Prueba simple:', { testData, testError, count: testData?.length });
      
      let query = supabase
        .from('fabrication_orders')
        .select('*, production_lines(name)')
        .order('created_at', { ascending: false });

              if (filters.status !== 'all' && filters.status) {
        const statusValue = filters.status as 'pendiente' | 'en_proceso' | 'completada' | 'validada' | 'albarana';
        query = query.eq('status', statusValue);
      }
      if (filters.customer) {
        query = query.ilike('customer', `%${filters.customer}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      setAllOFs(data || []);

      // Agrupar por cliente
      const ordersByCustomer = new Map<string, OrderSummary>();
      
      data?.forEach((of: any) => {
        const customer = of.customer || 'Sin cliente';
        
        if (!ordersByCustomer.has(customer)) {
          ordersByCustomer.set(customer, {
            customer,
            total_ofs: 0,
            completed_ofs: 0,
            in_progress_ofs: 0,
            pending_ofs: 0
          });
        }
        
        const summary = ordersByCustomer.get(customer)!;
        summary.total_ofs++;
        
        if (['completada', 'validada', 'albarana'].includes(of.status)) {
          summary.completed_ofs++;
        } else if (of.status === 'en_proceso') {
          summary.in_progress_ofs++;
        } else {
          summary.pending_ofs++;
        }
      });

      setOrders(Array.from(ordersByCustomer.values()));
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
            <div className="flex gap-4">
              <Input 
                placeholder="Buscar cliente..." 
                value={filters.customer}
                onChange={(e) => setFilters({...filters, customer: e.target.value})} 
                className="max-w-xs"
              />
              <Select 
                value={filters.status} 
                onValueChange={(val) => setFilters({...filters, status: val})}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_proceso">En Proceso</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                  <SelectItem value="validada">Validada</SelectItem>
                  <SelectItem value="albarana">Albaranada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Clientes/Pedidos */}
        <Card>
          <CardHeader>
            <CardTitle>Órdenes por Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron órdenes
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
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
                      <TableCell className="font-bold">{order.customer}</TableCell>
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
                            // Navegar a vista filtrada por cliente
                            setFilters({...filters, customer: order.customer});
                          }}
                        >
                          <Package2 className="mr-2 h-4 w-4" />
                          Ver OFs
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Lista de OFs (cuando hay filtro de cliente) */}
        {filters.customer && allOFs.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Órdenes de Fabricación - {filters.customer}</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setFilters({...filters, customer: ''})}
                >
                  Limpiar filtro
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SAP ID</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Línea</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allOFs.map(of => (
                    <TableRow key={of.id}>
                      <TableCell className="font-mono font-bold">
                        {of.sap_id || 'N/A'}
                      </TableCell>
                      <TableCell>{of.customer}</TableCell>
                      <TableCell>
                        {of.production_lines?.name || (
                          <span className="text-muted-foreground">No asignada</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={of.priority > 5 ? 'default' : 'outline'}>
                          {of.priority || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(of.status)}>
                          {of.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          onClick={() => navigate(`/dashboard/produccion/of/${of.id}`)}
                        >
                          Ver Detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DashboardProduccion;
