import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Upload, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type EmpleadoETT = {
  id: string;
  agency: string;
  contract_start: string;
  contract_end: string | null;
  hourly_rate: number;
  active: boolean;
  employees: {
    employee_code: string;
    full_name: string;
    email: string;
  };
};

type FacturaETT = {
  id: string;
  agency: string;
  invoice_number: string;
  invoice_date: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  validated: boolean;
  discrepancies: any[];
  file_url: string;
};

export const EmpleadosETT = () => {
  const { user, profile, userRoles, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [empleadosETT, setEmpleadosETT] = useState<EmpleadoETT[]>([]);
  const [facturas, setFacturas] = useState<FacturaETT[]>([]);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      const hasAdminGlobal = userRoles.includes('admin_global');
      const hasAdminDepartamento = userRoles.includes('admin_departamento') && 
                                   profile?.departamento === 'rrhh';
      
      if (!hasAdminGlobal && !hasAdminDepartamento) {
        navigate('/dashboard-produccion');
      }
    }
  }, [loading, user, userRoles, profile, navigate]);

  useEffect(() => {
    if (!loading && user) {
      loadEmpleadosETT();
      loadFacturas();
    }
  }, [loading, user]);

  const loadEmpleadosETT = async () => {
    try {
      const { data, error } = await supabase
        .from('ett_employees')
        .select(`
          *,
          employees (
            employee_code,
            full_name,
            email
          )
        `)
        .eq('active', true)
        .order('contract_start', { ascending: false });

      if (error) throw error;
      setEmpleadosETT(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los empleados ETT',
        variant: 'destructive'
      });
    }
  };

  const loadFacturas = async () => {
    try {
      const { data, error } = await supabase
        .from('ett_invoices')
        .select('*')
        .order('invoice_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setFacturas(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleUploadInvoice = async (file: File) => {
    setUploadingInvoice(true);
    try {
      const fileName = `ett-invoices/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ett-invoices')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('ett-invoices')
        .getPublicUrl(fileName);

      const { data: extractedData, error: extractError } = await supabase.functions
        .invoke('extract-invoice-data', {
          body: { fileUrl: urlData.publicUrl }
        });

      if (extractError) throw extractError;

      const { data: invoice, error: insertError } = await supabase
        .from('ett_invoices')
        .insert({
          agency: extractedData.agency || 'Faster',
          invoice_number: extractedData.invoiceNumber,
          invoice_date: extractedData.date,
          period_start: extractedData.periodStart,
          period_end: extractedData.periodEnd,
          file_url: urlData.publicUrl,
          file_size: file.size,
          extracted_data: extractedData,
          total_amount: extractedData.total,
          validated: false
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const discrepancies = await compareInvoiceVsAttendance(invoice.id);

      await supabase
        .from('ett_invoices')
        .update({
          validated: discrepancies.length === 0,
          discrepancies: discrepancies
        })
        .eq('id', invoice.id);

      if (discrepancies.length === 0) {
        toast({
          title: '✅ Factura Validada',
          description: 'La factura coincide con los fichajes'
        });
      } else {
        toast({
          title: '⚠️ Discrepancias Detectadas',
          description: `${discrepancies.length} diferencias encontradas`,
          variant: 'destructive'
        });
      }

      loadFacturas();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo procesar la factura',
        variant: 'destructive'
      });
    } finally {
      setUploadingInvoice(false);
    }
  };

  const compareInvoiceVsAttendance = async (invoiceId: string): Promise<any[]> => {
    return [];
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Empleados ETT</h1>
        <p className="text-muted-foreground">
          Gestión de empleados temporales y validación de facturas
        </p>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Empleados Activos</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Agencia</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead>Hasta</TableHead>
              <TableHead>Tarifa/h</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empleadosETT.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell className="font-medium">
                  {emp.employees.full_name}
                </TableCell>
                <TableCell className="font-mono">
                  {emp.employees.employee_code}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{emp.agency}</Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(emp.contract_start), 'd MMM yyyy', { locale: es })}
                </TableCell>
                <TableCell>
                  {emp.contract_end 
                    ? format(new Date(emp.contract_end), 'd MMM yyyy', { locale: es })
                    : 'Indefinido'
                  }
                </TableCell>
                <TableCell className="font-semibold">
                  {emp.hourly_rate.toFixed(2)} €/h
                </TableCell>
                <TableCell>
                  <Badge variant={emp.active ? 'default' : 'secondary'}>
                    {emp.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {empleadosETT.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No hay empleados ETT activos
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Validación de Facturas</h3>
        
        <div className="mb-6">
          <Label htmlFor="invoice-upload">Subir Factura (PDF)</Label>
          <div className="mt-2">
            <Input
              id="invoice-upload"
              type="file"
              accept=".pdf"
              disabled={uploadingInvoice}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadInvoice(file);
              }}
            />
            {uploadingInvoice && (
              <p className="text-sm text-muted-foreground mt-2">
                Procesando factura con IA...
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold">Facturas Recientes</h4>
          {facturas.map((factura) => (
            <Card key={factura.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{factura.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {factura.agency} · {format(new Date(factura.invoice_date), 'd MMM yyyy', { locale: es })}
                    </p>
                    <p className="text-sm">
                      Período: {format(new Date(factura.period_start), 'd MMM', { locale: es })} - 
                      {format(new Date(factura.period_end), 'd MMM yyyy', { locale: es })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">{factura.total_amount.toFixed(2)} €</p>
                  <div className="mt-2">
                    {factura.validated ? (
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Validado
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {factura.discrepancies.length} Discrepancias
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => window.open(factura.file_url, '_blank')}
                  >
                    Ver PDF
                  </Button>
                </div>
              </div>

              {!factura.validated && factura.discrepancies.length > 0 && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>
                    <strong>Discrepancias detectadas:</strong>
                    <ul className="list-disc list-inside mt-2">
                      {factura.discrepancies.map((disc: any, idx: number) => (
                        <li key={idx}>
                          {disc.employee}: Factura {disc.invoiceHours}h vs Fichajes {disc.realHours}h 
                          (Diferencia: {disc.difference.toFixed(2)}h = {disc.amount.toFixed(2)}€)
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </Card>
          ))}

          {facturas.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No hay facturas registradas
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
