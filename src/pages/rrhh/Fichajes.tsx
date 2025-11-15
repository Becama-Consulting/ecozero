import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Download, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Fichaje = {
  id: string;
  employee_id: string;
  check_in: string;
  check_out: string | null;
  status: 'completo' | 'pendiente' | 'incompleto' | 'justificado';
  employees: {
    employee_code: string;
    full_name: string;
    department: string;
  };
};

type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  department: string;
};

export const Fichajes = () => {
  const { user, userRoles, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [empleadosSinFichar, setEmpleadosSinFichar] = useState<Employee[]>([]);

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

  // Cargar fichajes del día seleccionado
  useEffect(() => {
    if (!loading && user) {
      loadFichajes();
      loadEmpleadosSinFichar();
    }
  }, [loading, user, selectedDate]);

  const loadFichajes = async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          employees (
            employee_code,
            full_name,
            department
          )
        `)
        .gte('check_in', `${dateStr}T00:00:00`)
        .lte('check_in', `${dateStr}T23:59:59`)
        .order('check_in');

      if (error) throw error;
      setFichajes(data || []);
    } catch (error) {
      console.error('Error cargando fichajes:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los fichajes',
        variant: 'destructive'
      });
    }
  };

  const loadEmpleadosSinFichar = async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Obtener todos los empleados activos
      const { data: empleados, error: empError } = await supabase
        .from('employees')
        .select('id, employee_code, full_name, email, department')
        .eq('active', true);

      if (empError) throw empError;

      // Obtener empleados que SÍ ficharon hoy
      const { data: fichajesHoy, error: fichError } = await supabase
        .from('attendance')
        .select('employee_id')
        .gte('check_in', `${dateStr}T00:00:00`)
        .lte('check_in', `${dateStr}T23:59:59`);

      if (fichError) throw fichError;

      const empleadosFichados = new Set(fichajesHoy?.map(f => f.employee_id) || []);
      
      // Filtrar empleados sin fichar
      const sinFichar = empleados?.filter(emp => !empleadosFichados.has(emp.id)) || [];
      setEmpleadosSinFichar(sinFichar);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSendReminder = async (employeeId: string, employeeName: string) => {
    // TODO: Integrar con n8n webhook para enviar email
    toast({
      title: 'Recordatorio enviado',
      description: `Se ha enviado un recordatorio a ${employeeName}`
    });
  };

  const handleMarkJustified = async (fichajeId: string) => {
    try {
      const { error } = await supabase
        .from('attendance')
        .update({ status: 'justificado' })
        .eq('id', fichajeId);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Fichaje marcado como justificado'
      });

      loadFichajes();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el fichaje',
        variant: 'destructive'
      });
    }
  };

  const handleExportExcel = () => {
    // TODO: Implementar exportación a Excel
    toast({
      title: 'Exportando',
      description: 'Generando archivo Excel...'
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completo: { variant: 'default' as const, label: '✅ Completo' },
      pendiente: { variant: 'secondary' as const, label: '⚠️ Pendiente' },
      incompleto: { variant: 'destructive' as const, label: '❌ Incompleto' },
      justificado: { variant: 'outline' as const, label: '✓ Justificado' }
    };

    const config = variants[status as keyof typeof variants] || variants.incompleto;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const calculateHours = (checkIn: string, checkOut: string | null): number => {
    if (!checkOut) return 0;
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
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
          <h1 className="text-3xl font-bold">Fichajes</h1>
          <p className="text-muted-foreground">
            Control horario - {format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {empleadosSinFichar.length > 0 && (
        <Card className="p-4 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-5 w-5 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-red-900 dark:text-red-100">
              {empleadosSinFichar.length} empleado(s) sin fichar
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {empleadosSinFichar.map(emp => (
              <Badge key={emp.id} variant="destructive">
                {emp.full_name}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <Tabs defaultValue="diario">
        <TabsList>
          <TabsTrigger value="diario">Vista Diaria</TabsTrigger>
          <TabsTrigger value="mensual">Vista Mensual</TabsTrigger>
        </TabsList>

        <TabsContent value="diario" className="space-y-4">
          {/* Selector de fecha */}
          <Card className="p-4 w-fit">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md"
              locale={es}
            />
          </Card>

          {/* Tabla de fichajes */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fichajes.map((fichaje) => (
                  <TableRow key={fichaje.id}>
                    <TableCell className="font-medium">
                      {fichaje.employees.full_name}
                    </TableCell>
                    <TableCell className="font-mono">
                      {fichaje.employees.employee_code}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{fichaje.employees.department}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(fichaje.check_in), 'HH:mm')}
                    </TableCell>
                    <TableCell>
                      {fichaje.check_out ? format(new Date(fichaje.check_out), 'HH:mm') : '-'}
                    </TableCell>
                    <TableCell>
                      {calculateHours(fichaje.check_in, fichaje.check_out).toFixed(2)} h
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(fichaje.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {fichaje.status === 'pendiente' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendReminder(fichaje.employee_id, fichaje.employees.full_name)}
                          >
                            <Bell className="h-4 w-4" />
                          </Button>
                        )}
                        {(fichaje.status === 'incompleto' || fichaje.status === 'pendiente') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkJustified(fichaje.id)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {fichajes.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No hay fichajes para esta fecha
            </div>
          )}
        </TabsContent>

        <TabsContent value="mensual">
          <Card className="p-6">
            <p className="text-muted-foreground">Vista mensual - Próximamente</p>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Leyenda */}
      <Card className="p-4">
        <h4 className="font-semibold mb-2">Leyenda de estados:</h4>
        <div className="flex gap-4 flex-wrap">
          <Badge variant="default">✅ Completo</Badge>
          <Badge variant="secondary">⚠️ Pendiente (sin salida)</Badge>
          <Badge variant="destructive">❌ Incompleto</Badge>
          <Badge variant="outline">✓ Justificado</Badge>
        </div>
      </Card>
    </div>
  );
};
