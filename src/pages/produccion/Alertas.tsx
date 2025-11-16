import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [showHistory, setShowHistory] = useState(false);
  const [historyAlerts, setHistoryAlerts] = useState<Alert[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
    resolved_today: 0,
    avg_resolution_time: 0
  });
  const [alertsByType, setAlertsByType] = useState<Array<{ type: string; count: number }>>([]);

  useEffect(() => {
    fetchAlerts();
    fetchStats();
    loadUsers();
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

  const fetchStats = async () => {
    try {
      const { data: severityData } = await supabase
        .from('alerts')
        .select('severity')
        .is('resolved_at', null);

      const critical = severityData?.filter(a => a.severity === 'critical').length || 0;
      const warning = severityData?.filter(a => a.severity === 'warning').length || 0;
      const info = severityData?.filter(a => a.severity === 'info').length || 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: resolvedToday } = await supabase
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .gte('resolved_at', today.toISOString());

      const { data: recentResolved } = await supabase
        .from('alerts')
        .select('created_at, resolved_at')
        .not('resolved_at', 'is', null)
        .gte('resolved_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      let avgTime = 0;
      if (recentResolved && recentResolved.length > 0) {
        const totalMinutes = recentResolved.reduce((sum, alert) => {
          const created = new Date(alert.created_at).getTime();
          const resolved = new Date(alert.resolved_at!).getTime();
          return sum + ((resolved - created) / (1000 * 60));
        }, 0);
        avgTime = Math.round(totalMinutes / recentResolved.length);
      }

      setStats({
        total: critical + warning + info,
        critical,
        warning,
        info,
        resolved_today: resolvedToday || 0,
        avg_resolution_time: avgTime
      });

      const { data: typeData } = await supabase
        .from('alerts')
        .select('type')
        .is('resolved_at', null);

      const typeCounts: Record<string, number> = {};
      typeData?.forEach(alert => {
        typeCounts[alert.type] = (typeCounts[alert.type] || 0) + 1;
      });

      const chartData = Object.entries(typeCounts).map(([type, count]) => ({
        type: type.replace(/_/g, ' ').toUpperCase(),
        count
      }));

      setAlertsByType(chartData);

    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('departamento', 'produccion');

      setUsers(profiles || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select(`
          *,
          fabrication_order:related_of_id(sap_id, customer)
        `)
        .not('resolved_at', 'is', null)
        .order('resolved_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistoryAlerts(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel("alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => {
          fetchAlerts();
          fetchStats();
        }
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
      fetchStats();
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
          <Button variant="outline" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Sistema de Alertas</h1>
          <p className="text-muted-foreground mt-1">
            Gestión de alertas de producción en tiempo real
          </p>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Activas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Críticas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-destructive">{stats.critical}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Resueltas Hoy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{stats.resolved_today}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Tiempo Promedio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.avg_resolution_time}m</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de alertas por tipo */}
        {alertsByType.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Alertas por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={alertsByType}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="type" className="text-xs" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          <Button 
            variant={!showHistory ? 'default' : 'outline'}
            onClick={() => setShowHistory(false)}
          >
            Activas ({alerts.length})
          </Button>
          <Button 
            variant={showHistory ? 'default' : 'outline'}
            onClick={() => {
              setShowHistory(true);
              fetchHistory();
            }}
          >
            Historial
          </Button>
        </div>

        {!showHistory ? (
          <>
            {/* Filtros */}
            <div className="flex flex-wrap gap-2">
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
                🔴 Críticas ({alerts.filter(a => a.severity === "critical").length})
              </Button>
              <Button
                variant={filter === "warning" ? "default" : "outline"}
                onClick={() => setFilter("warning")}
                size="sm"
              >
                🟡 Advertencias ({alerts.filter(a => a.severity === "warning").length})
              </Button>
              <Button
                variant={filter === "info" ? "secondary" : "outline"}
                onClick={() => setFilter("info")}
                size="sm"
              >
                🔵 Info ({alerts.filter(a => a.severity === "info").length})
              </Button>
            </div>

            {/* Lista de alertas activas */}
            <div className="space-y-4">
              {filteredAlerts.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No hay alertas activas en este momento
                  </CardContent>
                </Card>
              ) : (
                filteredAlerts.map((alert) => (
                  <Card key={alert.id} className="border-l-4" style={{
                    borderLeftColor: alert.severity === 'critical' ? 'hsl(var(--destructive))' :
                                     alert.severity === 'warning' ? 'hsl(var(--primary))' :
                                     'hsl(var(--muted))'
                  }}>
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xl">{getSeverityIcon(alert.severity)}</span>
                              <Badge variant={getSeverityColor(alert.severity)}>
                                {getSeverityText(alert.severity)}
                              </Badge>
                              <Badge variant="outline">
                                {alert.type.replace(/_/g, ' ').toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium mb-2">{alert.message}</p>
                            {alert.fabrication_order && (
                              <p className="text-xs text-muted-foreground">
                                OF: {alert.fabrication_order.sap_id || 'Sin SAP'} - {alert.fabrication_order.customer}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Creada: {new Date(alert.created_at).toLocaleString('es-ES')}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => resolveAlert(alert.id)}
                            size="sm"
                            variant="default"
                          >
                            ✓ Resolver
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
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {historyAlerts.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No hay alertas resueltas
                </CardContent>
              </Card>
            ) : (
              historyAlerts.map((alert) => (
                <Card key={alert.id} className="opacity-60">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{getSeverityIcon(alert.severity)}</span>
                          <Badge variant="outline">
                            {alert.type.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium line-through mb-2">{alert.message}</p>
                        {alert.fabrication_order && (
                          <p className="text-xs text-muted-foreground">
                            OF: {alert.fabrication_order.sap_id || 'Sin SAP'} - {alert.fabrication_order.customer}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Resuelta: {new Date(alert.resolved_at!).toLocaleString('es-ES')}
                        </p>
                      </div>
                      <Badge variant="secondary">Resuelta</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Alertas;
