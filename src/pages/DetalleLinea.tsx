import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ProductionLine {
  id: string;
  name: string;
  capacity: number;
  status: string;
}

interface FabricationOrder {
  id: string;
  sap_id: string | null;
  customer: string;
  status: string;
  created_at: string;
  assignee_id: string | null;
  profiles?: {
    name: string;
  };
}

const DetalleLinea = () => {
  const { lineaId } = useParams();
  const navigate = useNavigate();
  const [linea, setLinea] = useState<ProductionLine | null>(null);
  const [ofs, setOfs] = useState<FabricationOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLineaData();
    setupRealtimeSubscriptions();
  }, [lineaId]);

  const fetchLineaData = async () => {
    try {
      // Fetch line data
      const { data: lineData, error: lineError } = await supabase
        .from("production_lines")
        .select("*")
        .eq("id", lineaId)
        .single();

      if (lineError) throw lineError;
      setLinea(lineData);

      // Fetch OFs
      const { data: ofsData, error: ofsError } = await supabase
        .from("fabrication_orders")
        .select(`
          *,
          profiles:assignee_id(name)
        `)
        .eq("line_id", lineaId)
        .order("created_at", { ascending: false });

      if (ofsError) throw ofsError;
      setOfs(ofsData || []);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching line data:", error);
      toast.error("Error al cargar datos de la línea");
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel(`linea-${lineaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fabrication_orders",
          filter: `line_id=eq.${lineaId}`,
        },
        () => fetchLineaData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completada":
        return <Badge className="bg-success text-white">✓ Completada</Badge>;
      case "en_proceso":
        return <Badge className="bg-warning text-white">⊘ En Proceso</Badge>;
      case "pendiente":
        return <Badge variant="outline">○ Pendiente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!linea) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Línea no encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
              {linea.name} - LÍNEA
            </h1>
            <p className="text-muted-foreground mt-1">
              Estado: {linea.status === "active" ? "✓ Activa" : linea.status} | 
              Capacidad: {linea.capacity} OFs | 
              OFs activas: {ofs.filter(of => of.status !== "completada").length}/{linea.capacity}
            </p>
          </div>
          <Button onClick={() => navigate("/dashboard/produccion/nueva-of")}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva OF
          </Button>
        </div>

        {/* Naves Digitales - Vista Visual */}
        <Card>
          <CardHeader>
            <CardTitle>Naves Digitales - Vista en Tiempo Real</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: linea.capacity }).map((_, index) => {
                const of = ofs.filter(o => o.status !== "completada")[index];
                return (
                  <Card
                    key={index}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      of
                        ? of.status === "en_proceso"
                          ? "border-warning bg-warning/5"
                          : "border-muted bg-muted/20"
                        : "border-dashed"
                    }`}
                    onClick={() => of && navigate(`/dashboard/produccion/of/${of.id}`)}
                  >
                    <CardContent className="p-4 text-center">
                      <p className="font-mono text-sm text-muted-foreground mb-2">
                        PUESTO {index + 1}
                      </p>
                      {of ? (
                        <>
                          <p className="font-bold text-lg">OF #{of.sap_id || of.id.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground mt-1">{of.customer}</p>
                          <p className="text-xs mt-2">{getStatusBadge(of.status)}</p>
                          {of.profiles && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {of.profiles.name}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground text-sm py-4">LIBRE</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Listado de OFs */}
        <Card>
          <CardHeader>
            <CardTitle>Órdenes de Fabricación - {linea.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Asignado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ofs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No hay órdenes de fabricación en esta línea
                    </TableCell>
                  </TableRow>
                ) : (
                  ofs.map((of) => (
                    <TableRow key={of.id}>
                      <TableCell className="font-mono">
                        #{of.sap_id || of.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{of.customer}</TableCell>
                      <TableCell>{getStatusBadge(of.status)}</TableCell>
                      <TableCell>
                        {of.profiles?.name || "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(of.created_at).toLocaleDateString("es-ES")}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/dashboard/produccion/of/${of.id}`)}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DetalleLinea;
