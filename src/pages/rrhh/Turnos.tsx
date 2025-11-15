import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

type Turno = {
  id?: string;
  employee_id: string;
  employee_name?: string;
  date: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  employees?: {
    employee_code: string;
    full_name: string;
  };
};

type TurnoPreview = {
  employee_id: string;
  employee_name: string;
  date: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  planned_hours: number;
};

export const Turnos = () => {
  const { user, userRoles, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<TurnoPreview[]>([]);

  // Verificar permisos
  useEffect(() => {
    if (!loading && user) {
      const hasAccess = userRoles.some(r => 
        r.role === 'admin_global' || 
        r.role === 'admin_departamento'
      );
      
      if (!hasAccess) {
        navigate('/dashboard/produccion');
      }
    }
  }, [loading, user, userRoles, navigate]);

  // Cargar turnos del mes
  useEffect(() => {
    if (!loading && user) {
      loadTurnos();
    }
  }, [loading, user, currentMonth]);

  const loadTurnos = async () => {
    try {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('shifts')
        .select(`
          *,
          employees (
            employee_code,
            full_name
          )
        `)
        .gte('date', start)
        .lte('date', end)
        .order('date');

      if (error) throw error;
      setTurnos(data || []);
    } catch (error) {
      console.error('Error cargando turnos:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los turnos',
        variant: 'destructive'
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar que sea Excel
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: 'Error',
        description: 'El archivo debe ser formato Excel (.xlsx o .xls)',
        variant: 'destructive'
      });
      return;
    }
    
    // TODO: Parsear Excel y extraer datos
    // Por ahora, datos de ejemplo para demostración
    const mockData: TurnoPreview[] = [
      {
        employee_id: '123',
        employee_name: 'Juan Pérez',
        date: '2025-11-16',
        shift_type: 'manana',
        start_time: '08:00',
        end_time: '16:00',
        planned_hours: 7.5
      }
    ];

    setPreviewData(mockData);
    setShowUploadModal(false);
    setShowPreviewModal(true);
  };

  const handleConfirmUpload = async () => {
    try {
      // 1. Insertar en Supabase
      const { error: insertError } = await supabase
        .from('shifts')
        .insert(
          previewData.map(t => ({
            employee_id: t.employee_id,
            date: t.date,
            shift_type: t.shift_type,
            start_time: t.start_time,
            end_time: t.end_time
          }))
        );

      if (insertError) throw insertError;

      // 2. TODO: Enviar a n8n para sync con Factorial
      // await fetch('https://n8n.tudominio.com/webhook/turnos-upload', {
      //   method: 'POST',
      //   body: JSON.stringify({ turnos: previewData })
      // });

      toast({
        title: 'Éxito',
        description: `${previewData.length} turnos subidos correctamente`
      });

      setShowPreviewModal(false);
      setPreviewData([]);
      loadTurnos();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron subir los turnos',
        variant: 'destructive'
      });
    }
  };

  const getTurnoTypeBadge = (type: string) => {
    const variants = {
      manana: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200', label: 'Mañana' },
      tarde: { className: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200', label: 'Tarde' },
      noche: { className: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200', label: 'Noche' },
      partido: { className: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200', label: 'Partido' }
    };

    const config = variants[type as keyof typeof variants] || variants.manana;
    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const calculatePlannedHours = (startTime: string, endTime: string): number => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Turnos</h1>
          <p className="text-muted-foreground">
            Planificación de turnos - {format(currentMonth, "MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowUploadModal(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Excel
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Navegación de meses */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          >
            ← Mes anterior
          </Button>
          <h3 className="text-lg font-semibold capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: es })}
          </h3>
          <Button
            variant="outline"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          >
            Mes siguiente →
          </Button>
        </div>
      </Card>

      {/* Tabla de turnos */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Empleado</TableHead>
              <TableHead>Tipo Turno</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Horas Plan.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {turnos.map((turno) => (
              <TableRow key={turno.id}>
                <TableCell>
                  {format(new Date(turno.date), "d MMM yyyy", { locale: es })}
                </TableCell>
                <TableCell className="font-medium">
                  {turno.employees?.full_name}
                </TableCell>
                <TableCell>
                  {getTurnoTypeBadge(turno.shift_type)}
                </TableCell>
                <TableCell>{turno.start_time}</TableCell>
                <TableCell>{turno.end_time}</TableCell>
                <TableCell>
                  {calculatePlannedHours(turno.start_time, turno.end_time)} h
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {turnos.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No hay turnos planificados para este mes
        </div>
      )}

      {/* Modal subir Excel */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Turnos desde Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="excel-file">Seleccionar archivo Excel</Label>
              <Input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              El archivo debe contener las columnas: Empleado, Fecha, Tipo, Hora Inicio, Hora Fin
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal preview datos */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Confirmar Importación de Turnos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              Se importarán <strong>{previewData.length} turnos</strong>
            </p>
            <div className="max-h-96 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((turno, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{turno.employee_name}</TableCell>
                      <TableCell>{turno.date}</TableCell>
                      <TableCell>{getTurnoTypeBadge(turno.shift_type)}</TableCell>
                      <TableCell>{turno.start_time}</TableCell>
                      <TableCell>{turno.end_time}</TableCell>
                      <TableCell>{turno.planned_hours} h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmUpload}>
              Confirmar y Subir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
