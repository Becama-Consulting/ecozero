import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Edit } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditOFModal } from "@/components/produccion";

interface FabricationOrder {
  id: string;
  sap_id: string | null;
  customer: string;
  status: string;
  priority: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  line_id: string | null;
  supervisor_id: string | null;
}

interface ProductionStep {
  id: string;
  step_number: number;
  step_name: string;
  status: string;
  data_json: any;
  photos: string[];
  started_at: string | null;
  completed_at: string | null;
  assigned_to: string | null;
}

interface Operario {
  id: string;
  name: string;
}

interface HistoryEntry {
  id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  changed_by: string | null;
  profiles?: { name: string } | null;
}

const STEP_NAMES = [
  "CORTE",
  "COSTURA",
  "EMBALAJE",
  "ETIQUETADO",
  "CONTROL",
  "ALBARÁN"
];

const FichaOF = () => {
  const { ofId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [of, setOf] = useState<FabricationOrder | null>(null);
  const [steps, setSteps] = useState<ProductionStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [operarios, setOperarios] = useState<Operario[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    fetchOFData();
    fetchOperarios();
    fetchHistory();
    setupRealtimeSubscriptions();
  }, [ofId]);

  const fetchOFData = async () => {
    try {
      // Fetch OF data
      const { data: ofData, error: ofError } = await supabase
        .from("fabrication_orders")
        .select("*")
        .eq("id", ofId)
        .single();

      if (ofError) throw ofError;
      setOf(ofData);

      // Fetch production steps
      const { data: stepsData, error: stepsError } = await supabase
        .from("production_steps")
        .select("*")
        .eq("of_id", ofId)
        .order("step_number");

      if (stepsError) throw stepsError;
      setSteps(stepsData || []);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching OF data:", error);
      toast.error("Error al cargar datos de la OF");
      setLoading(false);
    }
  };

  const fetchOperarios = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, name, departamento')
        .eq('departamento', 'produccion');

      if (error) throw error;

      // Filtrar solo operarios (verificar roles)
      const operariosData = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);

          const hasOperarioRole = roles?.some(r => 
            r.role === 'operario' || r.role === 'supervisor'
          );

          return hasOperarioRole ? profile : null;
        })
      );

      setOperarios(operariosData.filter(Boolean) as Operario[]);
    } catch (error) {
      console.error('Error fetching operarios:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('of_history')
        .select('id, action, old_value, new_value, created_at, changed_by')
        .eq('of_id', ofId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // Fetch profile names for changed_by
      const historyWithProfiles = await Promise.all(
        (data || []).map(async (entry) => {
          if (!entry.changed_by) return { ...entry, profiles: null };
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', entry.changed_by)
            .single();
          
          return { ...entry, profiles: profile };
        })
      );
      
      setHistory(historyWithProfiles);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel(`of-${ofId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "production_steps",
          filter: `of_id=eq.${ofId}`,
        },
        () => fetchOFData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fabrication_orders",
          filter: `id=eq.${ofId}`,
        },
        () => fetchOFData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleChangeStatus = async (newStatus: string) => {
    if (!of) return;
    
    try {
      const oldStatus = of.status;
      const updates: any = { status: newStatus };
      
      if (newStatus === 'en_proceso' && !of.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (newStatus === 'completada' && !of.completed_at) {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('fabrication_orders')
        .update(updates)
        .eq('id', ofId);

      if (error) throw error;

      // Registrar en historial
      await supabase.from('of_history').insert({
        of_id: ofId,
        action: 'Cambio de estado',
        old_value: oldStatus,
        new_value: newStatus,
        changed_by: user?.id
      });

      toast.success(`Estado cambiado a: ${newStatus.replace('_', ' ').toUpperCase()}`);
      fetchOFData();
      fetchHistory();
    } catch (error) {
      console.error('Error changing status:', error);
      toast.error('Error al cambiar estado');
    }
  };

  const handleAssignOperario = async (stepId: string, operarioId: string) => {
    try {
      const { error } = await supabase
        .from('production_steps')
        .update({ assigned_to: operarioId || null })
        .eq('id', stepId);

      if (error) throw error;

      toast.success('Operario asignado correctamente');
      fetchOFData();
    } catch (error) {
      console.error('Error assigning operario:', error);
      toast.error('Error al asignar operario');
    }
  };

  const handleChangeStepStatus = async (stepId: string, currentStatus: string, stepNumber: number) => {
    try {
      // Validar que pasos previos estén completados
      if (stepNumber > 1) {
        const previousStep = steps.find(s => s.step_number === stepNumber - 1);
        if (previousStep && previousStep.status !== 'completado') {
          toast.error(`Debes completar el paso anterior (${previousStep.step_name}) primero`);
          return;
        }
      }

      let newStatus = '';
      const updates: any = {};

      if (currentStatus === 'pendiente') {
        newStatus = 'en_proceso';
        updates.started_at = new Date().toISOString();
      } else if (currentStatus === 'en_proceso') {
        newStatus = 'completado';
        updates.completed_at = new Date().toISOString();
      }

      if (!newStatus) return;

      updates.status = newStatus;

      const { error } = await supabase
        .from('production_steps')
        .update(updates)
        .eq('id', stepId);

      if (error) throw error;

      toast.success(`Paso actualizado: ${newStatus.replace('_', ' ').toUpperCase()}`);
      fetchOFData();

      // Si es el último paso y se completa, cambiar OF a completada
      if (stepNumber === 6 && newStatus === 'completado') {
        handleChangeStatus('completada');
      }
    } catch (error) {
      console.error('Error changing step status:', error);
      toast.error('Error al actualizar paso');
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case "completado":
      case "completada":
        return "✓";
      case "en_proceso":
        return "⊘";
      case "pendiente":
        return "○";
      default:
        return "○";
    }
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case "completado":
      case "completada":
        return "border-success bg-success/5";
      case "en_proceso":
        return "border-warning bg-warning/5";
      case "pendiente":
        return "border-muted";
      default:
        return "border-muted";
    }
  };

  const getStatusActions = () => {
    if (!of) return null;

    switch (of.status) {
      case 'pendiente':
        return (
          <Button onClick={() => handleChangeStatus('en_proceso')} size="sm">
            Iniciar Producción
          </Button>
        );
      case 'en_proceso':
        return (
          <Button onClick={() => handleChangeStatus('completada')} size="sm" variant="default">
            Marcar como Completada
          </Button>
        );
      case 'completada':
        return (
          <Button onClick={() => handleChangeStatus('validada')} size="sm" variant="secondary">
            Validar OF
          </Button>
        );
      case 'validada':
        return (
          <Button onClick={() => handleChangeStatus('albarana')} size="sm" variant="secondary">
            Generar Albarán
          </Button>
        );
      case 'albarana':
        return (
          <Badge variant="default" className="text-lg px-4 py-2">
            ✅ ALBARANADA
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStepActions = (step: ProductionStep | undefined, stepNumber: number) => {
    if (!step) return null;

    if (step.status === 'pendiente') {
      return (
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => handleChangeStepStatus(step.id, step.status, stepNumber)}
        >
          Iniciar Paso
        </Button>
      );
    }

    if (step.status === 'en_proceso') {
      return (
        <Button 
          size="sm" 
          variant="default"
          onClick={() => handleChangeStepStatus(step.id, step.status, stepNumber)}
        >
          Completar Paso
        </Button>
      );
    }

    return (
      <Badge variant="default">
        ✅ Completado
      </Badge>
    );
  };

  const calculateProgress = () => {
    const completed = steps.filter(s => s.status === "completado" || s.status === "completada").length;
    return (completed / 6) * 100;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!of) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Orden de fabricación no encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <Button variant="outline" onClick={() => navigate(-1)} className="w-fit">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Dashboard
          </Button>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                OF #{of.sap_id || of.id.slice(0, 8)}
              </h1>
              <p className="text-muted-foreground mt-1">
                Cliente: {of.customer} | Línea: {of.line_id ? "Asignada" : "Sin asignar"} | Supervisor: {of.supervisor_id ? "Asignado" : "Sin asignar"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              {getStatusActions()}
              <Badge className={
                of.status === "completada" ? "bg-success" :
                of.status === "en_proceso" ? "bg-warning" :
                of.status === "validada" ? "bg-secondary" :
                of.status === "albarana" ? "bg-primary" :
                "bg-muted"
              }>
                {of.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{of.customer}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Prioridad</p>
                <Badge variant={of.priority > 5 ? 'destructive' : of.priority > 2 ? 'default' : 'secondary'}>
                  {of.priority > 5 ? '🔴 ALTA' : of.priority > 2 ? '🟡 NORMAL' : '🟢 BAJA'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fecha Creación</p>
                <p className="font-medium">{new Date(of.created_at).toLocaleDateString("es-ES")}</p>
              </div>
              {of.started_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Fecha Inicio</p>
                  <p className="font-medium">{new Date(of.started_at).toLocaleDateString("es-ES")}</p>
                </div>
              )}
              {of.completed_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Fecha Finalización</p>
                  <p className="font-medium">{new Date(of.completed_at).toLocaleDateString("es-ES")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progreso */}
        <Card>
          <CardHeader>
            <CardTitle>Progreso de Producción</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Pasos Completados</span>
                <span className="font-medium">
                  {steps.filter(s => s.status === "completado" || s.status === "completada").length} / 6
                </span>
              </div>
              <Progress value={calculateProgress()} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Pasos de Producción */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {STEP_NAMES.map((stepName, index) => {
            const step = steps.find(s => s.step_number === index + 1);
            return (
              <Card key={index} className={`border-l-4 ${step ? getStepStatusColor(step.status) : "border-muted"}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="text-2xl">{step ? getStepStatusIcon(step.status) : "○"}</span>
                    <span>{index + 1}. {stepName}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {step ? (
                    <div className="space-y-3">
                      <p className="text-sm">
                        <span className="font-medium">Estado:</span>{" "}
                        {step.status === "completado" || step.status === "completada" ? "✓ COMPLETADO" :
                         step.status === "en_proceso" ? "⊘ EN PROGRESO" : "○ PENDIENTE"}
                      </p>
                      <div>
                        <Label htmlFor={`operario-${step.id}`} className="text-sm">Asignar Operario</Label>
                        <Select value={step.assigned_to || ''} onValueChange={(value) => handleAssignOperario(step.id, value)}>
                          <SelectTrigger id={`operario-${step.id}`} className="mt-1">
                            <SelectValue placeholder="Sin asignar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Sin asignar</SelectItem>
                            {operarios.map((op) => (<SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      {step.started_at && (<p className="text-sm"><span className="font-medium">Inicio:</span> {new Date(step.started_at).toLocaleString("es-ES")}</p>)}
                      {step.completed_at && (<p className="text-sm"><span className="font-medium">Completado:</span> {new Date(step.completed_at).toLocaleString("es-ES")}</p>)}
                      {step.data_json && Object.keys(step.data_json).length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">Datos capturados:</p>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">{JSON.stringify(step.data_json, null, 2)}</pre>
                        </div>
                      )}
                      {step.photos && step.photos.length > 0 && (<p className="text-sm">📷 {step.photos.length} foto(s) adjunta(s)</p>)}
                      <div className="mt-4 flex gap-2">{getStepActions(step, index + 1)}</div>
                    </div>
                  ) : (<p className="text-sm text-muted-foreground">Pendiente de asignación</p>)}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Historial de Cambios */}
        <Card>
          <CardHeader><CardTitle>📋 Historial de Cambios</CardTitle></CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay cambios registrados</p>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div key={entry.id} className="flex gap-3 border-l-2 border-muted pl-3 py-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{entry.action}</p>
                      {entry.old_value && entry.new_value && (<p className="text-xs text-muted-foreground">{entry.old_value} → {entry.new_value}</p>)}
                      <p className="text-xs text-muted-foreground mt-1">{entry.profiles?.name || 'Sistema'} • {new Date(entry.created_at).toLocaleString('es-ES')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Edición */}
      {of && (
        <EditOFModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSuccess={fetchOFData}
          of={{id: of.id, customer: of.customer, line_id: of.line_id, priority: of.priority, sap_id: of.sap_id}}
        />
      )}
    </div>
  );
};

export default FichaOF;
