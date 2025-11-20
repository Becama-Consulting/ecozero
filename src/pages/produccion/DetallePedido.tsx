import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Package, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface OF {
  id: string;
  sap_id: string | null;
  customer: string;
  status: string;
  priority: number | null;
  line_id: string | null;
  almacen?: string;
  material_preparado?: boolean;
  production_lines?: {
    name: string;
  };
}

interface ConsolidatedMaterial {
  material_codigo: string;
  material_descripcion: string;
  cantidad_total: number;
  unidad: string;
  estado: string;
  ofs_asociadas: string[];
}

const DetallePedido = () => {
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [pedidoInfo, setPedidoInfo] = useState<{ customer: string; created_at: string; status: string; pedido_comercial: string } | null>(null);
  const [ofs, setOfs] = useState<OF[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [consolidatedMaterials, setConsolidatedMaterials] = useState<ConsolidatedMaterial[]>([]);
  const [processingMaterial, setProcessingMaterial] = useState(false);

  useEffect(() => {
    if (!pedidoId || !user) return;
    fetchPedidoData();
    
    // Configurar realtime
    const channel = supabase
      .channel('detalle-pedido-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fabrication_orders'
        },
        () => {
          fetchPedidoData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pedidoId, user]);

  const fetchPedidoData = async () => {
    try {
      setLoading(true);
      
      // Obtener información inicial del pedido (primera OF)
      const { data: ofInicial, error: ofError } = await supabase
        .from('fabrication_orders')
        .select('customer, created_at, status, pedido_comercial')
        .eq('id', pedidoId)
        .single();

      if (ofError) throw ofError;
      setPedidoInfo(ofInicial);

      // Obtener todas las OFs del mismo PEDIDO COMERCIAL (no cliente)
      const { data: ofsData, error: ofsError } = await supabase
        .from('fabrication_orders')
        .select(`
          id,
          sap_id,
          customer,
          status,
          priority,
          line_id,
          pedido_comercial,
          material_preparado,
          production_lines(name)
        `)
        .eq('pedido_comercial', ofInicial.pedido_comercial)
        .order('created_at', { ascending: true });

      if (ofsError) throw ofsError;
      
      setOfs(ofsData || []);
      
    } catch (error) {
      console.error('Error al cargar datos del pedido:', error);
      toast.error('Error al cargar los datos del pedido');
    } finally {
      setLoading(false);
    }
  };

  const prepararMaterialPedido = async () => {
    try {
      const ofIds = ofs.map(of => of.id);
      
      // Consultar materiales por pedido_comercial
      const { data: materiales, error } = await supabase
        .from('bom_items')
        .select(`
          *,
          fabrication_orders!inner(
            id,
            sap_id,
            pedido_comercial
          )
        `)
        .eq('fabrication_orders.pedido_comercial', pedidoInfo?.pedido_comercial);

      if (error) throw error;

      if (!materiales || materiales.length === 0) {
        toast.error('No hay materiales definidos para estas OFs');
        return;
      }

      // Consolidar materiales
      const materialesMap = new Map();
      materiales.forEach(mat => {
        const key = mat.material_codigo;
        if (materialesMap.has(key)) {
          const existing = materialesMap.get(key);
          existing.cantidad_total += mat.cantidad_necesaria;
          existing.ofs_asociadas.push(mat.of_id);
        } else {
          materialesMap.set(key, {
            material_codigo: mat.material_codigo,
            material_descripcion: mat.material_descripcion,
            cantidad_total: mat.cantidad_necesaria,
            unidad: mat.unidad || 'UDS',
            estado: mat.estado,
            ofs_asociadas: [mat.of_id]
          });
        }
      });

      setConsolidatedMaterials(Array.from(materialesMap.values()));
      setShowMaterialModal(true);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al consultar materiales');
    }
  };

  const confirmarSolicitudMaterial = async () => {
    try {
      setProcessingMaterial(true);
      const ofIds = ofs.map(of => of.id);
      
      // Enviar webhook N8N PRIMERO
      let webhookSuccess = false;
      try {
        const response = await fetch('https://n8n-n8n.wgjrqh.easypanel.host/webhook/solicitud-material-produccion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pedido_id: pedidoId,
            cliente: pedidoInfo?.customer,
            total_ofs: ofs.length,
            materiales: consolidatedMaterials,
            solicitado_por: user?.email,
            timestamp: new Date().toISOString()
          })
        });
        
        if (response.ok) {
          webhookSuccess = true;
        } else {
          throw new Error(`Webhook respondió con status ${response.status}`);
        }
      } catch (webhookError) {
        console.error('Error webhook N8N:', webhookError);
        toast.error('Error al enviar solicitud a logística. Por favor, inténtalo de nuevo.');
        setProcessingMaterial(false);
        return; // Salir sin actualizar nada
      }

      // Solo si el webhook fue exitoso, actualizar datos
      if (webhookSuccess) {
        // Actualizar materiales
        for (const material of consolidatedMaterials) {
          await supabase
            .from('bom_items')
            .update({ estado: 'solicitado' })
            .eq('material_codigo', material.material_codigo)
            .in('of_id', ofIds);
        }

        // Actualizar OFs
        await supabase
          .from('fabrication_orders')
          .update({ 
            material_preparado: true
          })
          .in('id', ofIds);
      }

      setShowMaterialModal(false);
      toast.success('Material solicitado correctamente a logística');
      fetchPedidoData();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al solicitar material');
    } finally {
      setProcessingMaterial(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completada':
        return <Badge className="bg-green-600 text-white hover:bg-green-700">✓ Completada</Badge>;
      case 'validada':
        return <Badge className="bg-green-700 text-white hover:bg-green-800">✓✓ Validada</Badge>;
      case 'albarana':
        return <Badge className="bg-green-800 text-white hover:bg-green-900">📋 Albaranada</Badge>;
      case 'en_proceso':
        return <Badge className="bg-blue-600 text-white hover:bg-blue-700">⚙️ En Proceso</Badge>;
      case 'pendiente':
        return <Badge className="bg-orange-500 text-white hover:bg-orange-600">⏳ Pendiente</Badge>;
      case 'material_solicitado':
        return <Badge className="bg-purple-600 text-white hover:bg-purple-700">📦 Material Solicitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!pedidoInfo) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No se encontraron datos del pedido</p>
            <div className="flex justify-center mt-4">
              <Button onClick={() => navigate('/dashboard/produccion')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ofsEconordik = ofs.filter(of => of.production_lines?.name === 'ECONORDIK');
  const ofsQuadrilateral = ofs.filter(of => of.production_lines?.name === 'QUADRILATERAL');
  const ofsSinLinea = ofs.filter(of => !of.line_id);
  
  const ofsCompleted = ofs.filter(of => ['completada', 'validada', 'albarana'].includes(of.status)).length;
  const progressPercentage = (ofsCompleted / ofs.length) * 100;
  const todosMaterialPreparado = ofs.every(of => of.material_preparado);

  // Si la mayoría no tienen línea, mostrar todas juntas. Si algunas sí tienen, mostrar por separado
  const mostrarPorLineas = ofsEconordik.length > 0 || ofsQuadrilateral.length > 0;

  return (
    <div className="space-y-6 p-8">
      {/* Header con botón volver */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/dashboard/produccion')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">Detalle del Pedido</h1>
      </div>

      {/* Info General del Pedido */}
      <Card>
        <CardHeader>
          <CardTitle>Pedido {pedidoInfo.pedido_comercial} - {pedidoInfo.customer}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Nº Pedido Comercial</p>
              <p className="font-mono font-bold text-lg">{pedidoInfo.pedido_comercial}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha de Creación</p>
              <p className="font-bold">{new Date(pedidoInfo.created_at).toLocaleDateString('es-ES')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado General</p>
              {getStatusBadge(pedidoInfo.status)}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total OFs</p>
              <p className="font-bold text-2xl">{ofs.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Progreso Global</p>
              <Progress value={progressPercentage} className="mt-2" />
              <p className="text-xs mt-1 text-right">{ofsCompleted}/{ofs.length} completadas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botón Preparar Material */}
      <Card className="border-blue-500 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-blue-600" />
              <div>
                <h3 className="font-bold text-lg">Preparar Material del Pedido</h3>
                <p className="text-sm text-muted-foreground">
                  Solicita todos los materiales necesarios para las OFs de este pedido
                </p>
              </div>
            </div>
            <Button 
              onClick={prepararMaterialPedido}
              disabled={todosMaterialPreparado}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Package className="mr-2 h-4 w-4" />
              {todosMaterialPreparado ? 'Material Ya Solicitado' : 'Preparar Material'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de OFs */}
      {!mostrarPorLineas ? (
        // Si no hay líneas asignadas, mostrar todas las OFs juntas
        <Card>
          <CardHeader>
            <CardTitle>📋 Órdenes de Fabricación del Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SAP ID</TableHead>
                    <TableHead>Línea</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ofs.map(of => (
                    <TableRow key={of.id}>
                      <TableCell className="font-mono font-bold">{of.sap_id || 'Sin código'}</TableCell>
                      <TableCell>{of.production_lines?.name || 'No asignada'}</TableCell>
                      <TableCell>
                        <Badge variant={(of.priority || 0) > 5 ? 'default' : 'outline'}>
                          {of.priority || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(of.status)}
                      </TableCell>
                      <TableCell>
                        {of.material_preparado ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" /> Preparado
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Pendiente</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => navigate(`/dashboard/produccion/of/${of.id}`)}
                        >
                          Ver Detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tabla ECONORDIK */}
          {ofsEconordik.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🏭 Línea ECONORDIK
                  <Badge variant="secondary">{ofsEconordik.length} OFs</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SAP ID</TableHead>
                        <TableHead>Línea</TableHead>
                        <TableHead>Prioridad</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ofsEconordik.map(of => (
                        <TableRow key={of.id}>
                          <TableCell className="font-mono font-bold">{of.sap_id || 'Sin código'}</TableCell>
                          <TableCell>{of.production_lines?.name || 'No asignada'}</TableCell>
                          <TableCell>
                            <Badge variant={(of.priority || 0) > 5 ? 'default' : 'outline'}>
                              {of.priority || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(of.status)}
                          </TableCell>
                          <TableCell>
                            {of.material_preparado ? (
                              <span className="text-green-600 flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" /> Preparado
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Pendiente</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => navigate(`/dashboard/produccion/of/${of.id}`)}
                            >
                              Ver Detalle
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabla QUADRILATERAL */}
          {ofsQuadrilateral.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🏭 Línea QUADRILATERAL
                  <Badge variant="secondary">{ofsQuadrilateral.length} OFs</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SAP ID</TableHead>
                        <TableHead>Línea</TableHead>
                        <TableHead>Prioridad</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ofsQuadrilateral.map(of => (
                        <TableRow key={of.id}>
                          <TableCell className="font-mono font-bold">{of.sap_id || 'Sin código'}</TableCell>
                          <TableCell>{of.production_lines?.name || 'No asignada'}</TableCell>
                          <TableCell>
                            <Badge variant={(of.priority || 0) > 5 ? 'default' : 'outline'}>
                              {of.priority || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(of.status)}
                          </TableCell>
                          <TableCell>
                            {of.material_preparado ? (
                              <span className="text-green-600 flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" /> Preparado
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Pendiente</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => navigate(`/dashboard/produccion/of/${of.id}`)}
                            >
                              Ver Detalle
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabla OFs Sin Línea */}
          {ofsSinLinea.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📦 Sin Línea Asignada (Accesorios/Materiales)
                  <Badge variant="outline">{ofsSinLinea.length} OFs</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SAP ID</TableHead>
                        <TableHead>Línea</TableHead>
                        <TableHead>Prioridad</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ofsSinLinea.map(of => (
                        <TableRow key={of.id}>
                          <TableCell className="font-mono font-bold">{of.sap_id || 'Sin código'}</TableCell>
                          <TableCell>{of.production_lines?.name || 'No asignada'}</TableCell>
                          <TableCell>
                            <Badge variant={(of.priority || 0) > 5 ? 'default' : 'outline'}>
                              {of.priority || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(of.status)}
                          </TableCell>
                          <TableCell>
                            {of.material_preparado ? (
                              <span className="text-green-600 flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" /> Preparado
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Pendiente</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => navigate(`/dashboard/produccion/of/${of.id}`)}
                            >
                              Ver Detalle
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Modal de Confirmación de Material */}
      <Dialog open={showMaterialModal} onOpenChange={setShowMaterialModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Materiales a Solicitar - {pedidoInfo.customer}</DialogTitle>
            <DialogDescription>
              Lista consolidada de materiales para {ofs.length} OFs
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Cantidad Total</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead># OFs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consolidatedMaterials.map(mat => (
                  <TableRow key={mat.material_codigo}>
                    <TableCell className="font-mono font-bold">{mat.material_codigo}</TableCell>
                    <TableCell>{mat.material_descripcion}</TableCell>
                    <TableCell className="font-bold text-lg">{mat.cantidad_total}</TableCell>
                    <TableCell>{mat.unidad}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{mat.estado}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge>{mat.ofs_asociadas.length}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowMaterialModal(false)}
              disabled={processingMaterial}
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmarSolicitudMaterial}
              disabled={processingMaterial}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processingMaterial ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Solicitando...
                </>
              ) : (
                <>
                  <Package className="mr-2 h-4 w-4" />
                  Solicitar a Logística
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DetallePedido;
