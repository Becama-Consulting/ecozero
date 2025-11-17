import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, Download, Upload, Play, AlertTriangle, 
  CheckCircle, Clock, TrendingUp, RefreshCw, Settings
} from "lucide-react";
import { toast } from "sonner";

interface Order {
  id: string;
  customer: string;
  priority: number;
  estimated_hours: number;
  sap_id?: string;
  materials_available: boolean;
  required_capacity: number;
}

interface SequenceItem {
  order_id: string;
  line_id: string;
  position: number;
  estimated_start: string;
  estimated_end: string;
}

interface Conflict {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  affected_orders: string[];
}

const SecuenciacionProduccion = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [sequence, setSequence] = useState<SequenceItem[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [autoCreate, setAutoCreate] = useState(false);

  // Formulario para agregar pedido manual
  const [newOrder, setNewOrder] = useState({
    customer: '',
    priority: 5,
    estimated_hours: 8,
    materials_available: true
  });

  const importFromSAP = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-orders', {
        body: { source: 'sap' }
      });

      if (error) throw error;

      if (data.orders && data.orders.length > 0) {
        setOrders(prev => [...prev, ...data.orders]);
        toast.success(`${data.imported} pedidos importados desde SAP`);
      } else {
        toast.info('No hay pedidos nuevos para importar');
      }
    } catch (error: any) {
      console.error('Error importing from SAP:', error);
      toast.error(error.message || 'Error al importar desde SAP');
    } finally {
      setLoading(false);
    }
  };

  const addManualOrder = () => {
    if (!newOrder.customer.trim()) {
      toast.error('Debe especificar un cliente');
      return;
    }

    const order: Order = {
      id: crypto.randomUUID(),
      customer: newOrder.customer,
      priority: newOrder.priority,
      estimated_hours: newOrder.estimated_hours,
      materials_available: newOrder.materials_available,
      required_capacity: 1
    };

    setOrders(prev => [...prev, order]);
    toast.success('Pedido agregado');

    // Reset form
    setNewOrder({
      customer: '',
      priority: 5,
      estimated_hours: 8,
      materials_available: true
    });
  };

  const removeOrder = (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const runSequencing = async () => {
    if (orders.length === 0) {
      toast.error('No hay pedidos para secuenciar');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sequence-production', {
        body: { 
          orders,
          auto_create: autoCreate
        }
      });

      if (error) throw error;

      setSequence(data.sequence || []);
      setConflicts(data.conflicts || []);
      setMetrics(data.metrics || null);

      const criticalConflicts = data.conflicts?.filter((c: Conflict) => c.severity === 'critical').length || 0;
      
      if (autoCreate && data.sequence?.length > 0) {
        toast.success(`Secuenciación completada y ${data.sequence.length} OFs creadas automáticamente`);
      } else {
        toast.success(`Secuenciación completada: ${data.sequence?.length || 0} pedidos asignados`);
      }

      if (criticalConflicts > 0) {
        toast.warning(`${criticalConflicts} conflictos críticos detectados`);
      }
    } catch (error: any) {
      console.error('Error running sequencing:', error);
      toast.error(error.message || 'Error al ejecutar secuenciación');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'default';
      default: return 'secondary';
    }
  };

  const getConflictIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/dashboard/produccion')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Secuenciación de Producción</h1>
              <p className="text-muted-foreground">
                Optimización automática de órdenes de fabricación
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-4">
              <Switch 
                checked={autoCreate} 
                onCheckedChange={setAutoCreate}
                id="auto-create"
              />
              <Label htmlFor="auto-create" className="cursor-pointer">
                Crear OFs automáticamente
              </Label>
            </div>
            <Button onClick={importFromSAP} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              Importar desde SAP
            </Button>
            <Button 
              onClick={runSequencing} 
              disabled={loading || orders.length === 0}
              variant="default"
            >
              <Play className="h-4 w-4 mr-2" />
              Ejecutar Secuenciación
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Pedidos</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_orders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tiempo Espera Promedio</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.avg_wait_time}h</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Utilización Capacidad</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.capacity_utilization}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Conflictos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{conflicts.length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList>
          <TabsTrigger value="orders">
            Pedidos ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="sequence">
            Secuencia Generada ({sequence.length})
          </TabsTrigger>
          <TabsTrigger value="conflicts">
            Conflictos ({conflicts.length})
          </TabsTrigger>
        </TabsList>

        {/* Pestaña Pedidos */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agregar Pedido Manual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <Label htmlFor="customer">Cliente</Label>
                  <Input
                    id="customer"
                    value={newOrder.customer}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, customer: e.target.value }))}
                    placeholder="Nombre del cliente"
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Prioridad (1-10)</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    max="10"
                    value={newOrder.priority}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="hours">Horas Estimadas</Label>
                  <Input
                    id="hours"
                    type="number"
                    min="1"
                    value={newOrder.estimated_hours}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, estimated_hours: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newOrder.materials_available}
                      onCheckedChange={(checked) => setNewOrder(prev => ({ ...prev, materials_available: checked }))}
                      id="materials"
                    />
                    <Label htmlFor="materials">Materiales OK</Label>
                  </div>
                </div>
                <div className="flex items-end">
                  <Button onClick={addManualOrder} className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lista de Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No hay pedidos. Importa desde SAP o agrega manualmente.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>SAP ID</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Horas Est.</TableHead>
                      <TableHead>Materiales</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.customer}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {order.sap_id || 'Manual'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={order.priority > 7 ? 'destructive' : 'default'}>
                            {order.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>{order.estimated_hours}h</TableCell>
                        <TableCell>
                          {order.materials_available ? (
                            <Badge variant="outline" className="text-green-600">
                              Disponibles
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              Pendiente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOrder(order.id)}
                          >
                            Eliminar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña Secuencia */}
        <TabsContent value="sequence" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Secuencia Óptima Generada</CardTitle>
            </CardHeader>
            <CardContent>
              {sequence.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Ejecuta la secuenciación para generar la planificación óptima
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posición</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Línea</TableHead>
                      <TableHead>Inicio Estimado</TableHead>
                      <TableHead>Fin Estimado</TableHead>
                      <TableHead>Duración</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sequence.map((item, idx) => {
                      const order = orders.find(o => o.id === item.order_id);
                      const start = new Date(item.estimated_start);
                      const end = new Date(item.estimated_end);
                      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Badge variant="outline">{item.position}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {order?.customer || 'Desconocido'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {item.line_id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="text-sm">
                            {start.toLocaleString('es-ES')}
                          </TableCell>
                          <TableCell className="text-sm">
                            {end.toLocaleString('es-ES')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {Math.round(durationHours)}h
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña Conflictos */}
        <TabsContent value="conflicts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conflictos Detectados</CardTitle>
            </CardHeader>
            <CardContent>
              {conflicts.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {sequence.length > 0 
                    ? '✅ No se detectaron conflictos en la secuencia generada'
                    : 'Ejecuta la secuenciación para detectar posibles conflictos'
                  }
                </div>
              ) : (
                <div className="space-y-3">
                  {conflicts.map((conflict, idx) => (
                    <div 
                      key={idx} 
                      className="p-4 border rounded-lg flex items-start gap-3"
                    >
                      {getConflictIcon(conflict.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getSeverityColor(conflict.severity) as any}>
                            {conflict.severity.toUpperCase()}
                          </Badge>
                          <span className="text-sm font-mono text-muted-foreground">
                            {conflict.type}
                          </span>
                        </div>
                        <p className="text-sm">{conflict.message}</p>
                        {conflict.affected_orders.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Afecta a: {conflict.affected_orders.length} pedido(s)
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecuenciacionProduccion;
