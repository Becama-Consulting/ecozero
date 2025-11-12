import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  created_at: string;
  resolved_at: string | null;
  related_of_id: string | null;
  fabrication_order?: {
    sap_id: string | null;
    customer: string;
  } | null;
}

const Alertas = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");

  useEffect(() => {
    fetchAlerts();
    setupRealtimeSubscriptions();
  }, []);

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select(`
          *,
          fabrication_order:related_of_id(sap_id, customer)
        `)
        .is("resolved_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      toast.error("Error al cargar alertas");
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel("alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => fetchAlerts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from("alerts")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", alertId);

      if (error) throw error;
      toast.success("Alerta resuelta");
      fetchAlerts();
    } catch (error) {
      console.error("Error resolving alert:", error);
      toast.error("Error al resolver alerta");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "warning":
        return "default";
      case "info":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🔴";
      case "warning":
        return "🟡";
      case "info":
        return "🔵";
      default:
        return "⚪";
    }
  };

  const getSeverityText = (severity: string) => {
    switch (severity) {
      case "critical":
        return "CRÍTICA";
      case "warning":
        return "ADVERTENCIA";
      case "info":
        return "INFORMACIÓN";
      default:
        return severity.toUpperCase();
    }
  };

  const filteredAlerts = filter === "all" 
    ? alerts 
    : alerts.filter(a => a.severity === filter);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
            onClick={() => navigate("/dashboard/produccion")}
            className="mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <h1 className="text-3xl font-bold text-foreground">
            Alertas Críticas - Producción
          </h1>
          <p className="text-muted-foreground mt-1">
            {filteredAlerts.length} alerta(s) activa(s)
          </p>
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            size="sm"
          >
            Todas ({alerts.length})
          </Button>
          <Button
            variant={filter === "critical" ? "destructive" : "outline"}
            onClick={() => setFilter("critical")}
            size="sm"
          >
            Críticas ({alerts.filter(a => a.severity === "critical").length})
          </Button>
          <Button
            variant={filter === "warning" ? "default" : "outline"}
            onClick={() => setFilter("warning")}
            size="sm"
          >
            Advertencias ({alerts.filter(a => a.severity === "warning").length})
          </Button>
          <Button
            variant={filter === "info" ? "secondary" : "outline"}
            onClick={() => setFilter("info")}
            size="sm"
          >
            Info ({alerts.filter(a => a.severity === "info").length})
          </Button>
        </div>

        {/* Lista de Alertas */}
        <div className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay alertas activas
              </CardContent>
            </Card>
          ) : (
            filteredAlerts.map((alert) => (
              <Card key={alert.id} className={`border-l-4 ${
                alert.severity === "critical" ? "border-destructive" :
                alert.severity === "warning" ? "border-warning" :
                "border-info"
              }`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getSeverityIcon(alert.severity)}</span>
                      <div>
                        <CardTitle className="text-lg">
                          <Badge variant={getSeverityColor(alert.severity)}>
                            {getSeverityText(alert.severity)}
                          </Badge>
                          {" - " + alert.type.toUpperCase().replace("_", " ")}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(alert.created_at).toLocaleString("es-ES")}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>{alert.message}</p>
                  
                  {alert.fabrication_order && (
                    <div className="bg-muted p-3 rounded">
                      <p className="text-sm">
                        <span className="font-medium">OF relacionada:</span>{" "}
                        #{alert.fabrication_order.sap_id || "N/A"} - {alert.fabrication_order.customer}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => resolveAlert(alert.id)}
                      size="sm"
                      variant="outline"
                    >
                      Resolver
                    </Button>
                    {alert.related_of_id && (
                      <Button
                        onClick={() => navigate(`/dashboard/produccion/of/${alert.related_of_id}`)}
                        size="sm"
                        variant="outline"
                      >
                        Ver OF
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Alertas;
