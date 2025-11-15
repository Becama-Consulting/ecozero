import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, AlertTriangle } from 'lucide-react';

type Nomina = {
  id: string;
  employee_id: string;
  period: string;
  base_salary: number;
  extras: number;
  bonuses: number;
  deductions: number;
  gross_salary: number;
  net_salary: number;
  status: string;
  has_discrepancies: boolean;
  discrepancies: any;
  employees: {
    employee_code: string;
    full_name: string;
  };
};

export const Nominas = () => {
  const { user, userRoles, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

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

  // Cargar nóminas del período
  useEffect(() => {
    if (!loading && user) {
      loadNominas();
    }
  }, [loading, user, selectedPeriod]);

  const loadNominas = async () => {
    try {
      const { data, error } = await supabase
        .from('payroll')
        .select(`
          *,
          employees (
            employee_code,
            full_name
          )
        `)
        .eq('period', selectedPeriod)
        .order('employees(full_name)');

      if (error) throw error;
      setNominas(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las nóminas',
        variant: 'destructive'
      });
    }
  };

  const handleExportVacaciones = async () => {
    toast({
      title: 'Exportando vacaciones',
      description: 'Generando Excel desde Factorial...'
    });
  };

  const handleImportVariables = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    toast({
      title: 'Importando variables',
      description: 'Procesando hoja de variables...'
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      borrador: { variant: 'secondary' as const, label: 'Borrador' },
      pendiente_validacion: { variant: 'secondary' as const, label: 'Pendiente' },
      validado: { variant: 'default' as const, label: 'Validado' },
      con_discrepancias: { variant: 'destructive' as const, label: 'Con Discrepancias' },
      aprobado: { variant: 'default' as const, label: 'Aprobado' },
      pagado: { variant: 'outline' as const, label: 'Pagado' }
    };

    const config = variants[status as keyof typeof variants] || variants.borrador;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Generar períodos últimos 12 meses
  const generatePeriods = () => {
    const periods = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      periods.push(period);
    }
    return periods;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const nominasConDiscrepancias = nominas.filter(n => n.has_discrepancies);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Nóminas</h1>
          <p className="text-muted-foreground">Validación y gestión de nóminas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportVacaciones}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Vacaciones
          </Button>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              Importar Variables
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportVariables}
              />
            </label>
          </Button>
        </div>
      </div>

      {/* Selector período */}
      <div className="flex items-center gap-4">
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {generatePeriods().map(period => (
              <SelectItem key={period} value={period}>
                {new Date(period + '-01').toLocaleDateString('es-ES', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {nominasConDiscrepancias.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {nominasConDiscrepancias.length} nómina(s) con discrepancias requieren revisión
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Tabla */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Extras</TableHead>
              <TableHead>Bonos</TableHead>
              <TableHead>Deducciones</TableHead>
              <TableHead>Bruto</TableHead>
              <TableHead>Neto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nominas.map((nomina) => (
              <TableRow 
                key={nomina.id}
                className={nomina.has_discrepancies ? 'bg-red-50 dark:bg-red-950' : ''}
              >
                <TableCell className="font-medium">
                  {nomina.employees.full_name}
                </TableCell>
                <TableCell>{nomina.base_salary.toFixed(2)} €</TableCell>
                <TableCell>{nomina.extras.toFixed(2)} €</TableCell>
                <TableCell>{nomina.bonuses.toFixed(2)} €</TableCell>
                <TableCell>{nomina.deductions.toFixed(2)} €</TableCell>
                <TableCell className="font-semibold">
                  {nomina.gross_salary.toFixed(2)} €
                </TableCell>
                <TableCell className="font-bold">
                  {nomina.net_salary.toFixed(2)} €
                </TableCell>
                <TableCell>{getStatusBadge(nomina.status)}</TableCell>
                <TableCell>
                  {nomina.has_discrepancies && (
                    <Button size="sm" variant="destructive">
                      Ver Discrepancias
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {nominas.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No hay nóminas para este período
        </div>
      )}
    </div>
  );
};
