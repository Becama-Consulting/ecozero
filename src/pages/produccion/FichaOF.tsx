import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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
  const [of, setOf] = useState<FabricationOrder | null>(null);
  const [steps, setSteps] = useState<ProductionStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOFData();
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
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

  const calculateProgress = () => {
    const completed = steps.filter(s => s.status === "completada").length;
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
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
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
            <Badge className={
              of.status === "completada" ? "bg-success" :
              of.status === "en_proceso" ? "bg-warning" :
              "bg-muted"
            }>
              {of.status.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle>Información de la Orden</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">ID SAP</p>
              <p className="font-mono">{of.sap_id || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p>{of.customer}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Línea</p>
              <p>{of.line_id || "Sin asignar"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Supervisor</p>
              <p>{of.supervisor_id || "Sin asignar"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha inicio</p>
              <p>{of.started_at ? new Date(of.started_at).toLocaleString("es-ES") : "No iniciada"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha completada</p>
              <p>{of.completed_at ? new Date(of.completed_at).toLocaleString("es-ES") : "En progreso"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Prioridad</p>
              <Badge variant={of.priority > 3 ? "destructive" : "secondary"}>
                {of.priority > 3 ? "ALTA" : of.priority > 1 ? "NORMAL" : "BAJA"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Progreso */}
        <Card>
          <CardHeader>
            <CardTitle>Progreso Total: {steps.filter(s => s.status === "completada").length}/6 pasos</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={calculateProgress()} className="h-4" />
          </CardContent>
        </Card>

        {/* Pasos de Producción */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Flujo de Producción</h2>
          
          {STEP_NAMES.map((stepName, index) => {
            const step = steps.find(s => s.step_number === index + 1);
            
            return (
              <Card key={index} className={`border-l-4 ${step ? getStepStatusColor(step.status) : "border-muted"}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">
                      {step ? getStepStatusIcon(step.status) : "○"}
                    </span>
                    <span>{index + 1}. {stepName}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {step ? (
                    <div className="space-y-2">
                      <p className="text-sm">
                        <span className="font-medium">Estado:</span>{" "}
                        {step.status === "completada" ? "✓ COMPLETADO" :
                         step.status === "en_proceso" ? "⊘ EN PROGRESO" :
                         "○ PENDIENTE"}
                      </p>
                      {step.assigned_to && (
                        <p className="text-sm">
                          <span className="font-medium">Operario:</span> {step.assigned_to}
                        </p>
                      )}
                      {step.started_at && (
                        <p className="text-sm">
                          <span className="font-medium">Inicio:</span>{" "}
                          {new Date(step.started_at).toLocaleString("es-ES")}
                        </p>
                      )}
                      {step.completed_at && (
                        <p className="text-sm">
                          <span className="font-medium">Completado:</span>{" "}
                          {new Date(step.completed_at).toLocaleString("es-ES")}
                        </p>
                      )}
                      {step.data_json && Object.keys(step.data_json).length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">Datos capturados:</p>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                            {JSON.stringify(step.data_json, null, 2)}
                          </pre>
                        </div>
                      )}
                      {step.photos && step.photos.length > 0 && (
                        <p className="text-sm">
                          📷 {step.photos.length} foto(s) adjunta(s)
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Pendiente de asignación
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FichaOF;
