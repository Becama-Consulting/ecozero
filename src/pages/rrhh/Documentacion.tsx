import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Eye, AlertCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

type Document = {
  id: string;
  document_type: string;
  document_name: string;
  file_url: string;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  validated_at: string | null;
};

type EmployeeWithDocs = {
  id: string;
  employee_code: string;
  full_name: string;
  department: string;
  employee_documents: Document[];
};

const REQUIRED_DOCUMENTS = [
  { type: 'dni', label: 'DNI/NIE', hasExpiry: true },
  { type: 'seguridad_social', label: 'Nº Seguridad Social', hasExpiry: false },
  { type: 'contrato', label: 'Contrato Firmado', hasExpiry: false },
  { type: 'titulacion', label: 'Titulación', hasExpiry: false },
  { type: 'certificado_delitos', label: 'Certificado Delitos', hasExpiry: true },
  { type: 'reconocimiento_medico', label: 'Reconocimiento Médico', hasExpiry: true },
  { type: 'formacion_prl', label: 'Formación PRL', hasExpiry: true },
  { type: 'cuenta_bancaria', label: 'Cuenta Bancaria', hasExpiry: false }
];

export const Documentacion = () => {
  const { user, profile, userRoles, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [empleados, setEmpleados] = useState<EmployeeWithDocs[]>([]);
  const [filteredEmpleados, setFilteredEmpleados] = useState<EmployeeWithDocs[]>([]);
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

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
      loadEmpleados();
    }
  }, [loading, user]);

  useEffect(() => {
    let filtered = empleados;

    if (filterDept !== 'all') {
      filtered = filtered.filter(emp => emp.department === filterDept);
    }

    if (filterStatus === 'completos') {
      filtered = filtered.filter(emp => calculateCompliance(emp) === 100);
    } else if (filterStatus === 'incompletos') {
      filtered = filtered.filter(emp => calculateCompliance(emp) < 100);
    } else if (filterStatus === 'caducados') {
      filtered = filtered.filter(emp => 
        emp.employee_documents.some(doc => isExpired(doc.expiry_date))
      );
    }

    setFilteredEmpleados(filtered);
  }, [empleados, filterDept, filterStatus]);

  const loadEmpleados = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          id,
          employee_code,
          full_name,
          department,
          employee_documents (
            id,
            document_type,
            document_name,
            file_url,
            issue_date,
            expiry_date,
            status,
            validated_at
          )
        `)
        .eq('active', true)
        .order('full_name');

      if (error) throw error;
      setEmpleados(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los empleados',
        variant: 'destructive'
      });
    }
  };

  const calculateCompliance = (empleado: EmployeeWithDocs): number => {
    const totalRequired = REQUIRED_DOCUMENTS.length;
    const uploaded = REQUIRED_DOCUMENTS.filter(req => 
      empleado.employee_documents.some(doc => doc.document_type === req.type)
    ).length;
    
    return Math.round((uploaded / totalRequired) * 100);
  };

  const isExpired = (expiryDate: string | null): boolean => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const isExpiringSoon = (expiryDate: string | null): boolean => {
    if (!expiryDate) return false;
    const daysUntilExpiry = differenceInDays(new Date(expiryDate), new Date());
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  };

  const getDocumentStatus = (empleado: EmployeeWithDocs, docType: string) => {
    const doc = empleado.employee_documents.find(d => d.document_type === docType);
    
    if (!doc) {
      return { badge: <Badge variant="destructive">❌ Falta</Badge>, doc: null };
    }
    
    if (isExpired(doc.expiry_date)) {
      return { 
        badge: <Badge variant="destructive">⚠️ Caducado</Badge>, 
        doc 
      };
    }
    
    if (isExpiringSoon(doc.expiry_date)) {
      return { 
        badge: <Badge variant="secondary">⏳ Caduca pronto</Badge>, 
        doc 
      };
    }
    
    return { 
      badge: <Badge variant="default">✅ OK</Badge>, 
      doc 
    };
  };

  const handleUploadDocument = async (employeeId: string, docType: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${employeeId}/${docType}_${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('employee-documents')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('employee_documents')
        .insert({
          employee_id: employeeId,
          document_type: docType,
          document_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          file_type: file.type,
          status: 'entregado',
          uploaded_by: user!.id
        });

      if (insertError) throw insertError;

      toast({
        title: 'Éxito',
        description: 'Documento subido correctamente'
      });

      loadEmpleados();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo subir el documento',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  }

  const globalCompliance = empleados.length > 0
    ? Math.round(empleados.reduce((sum, emp) => sum + calculateCompliance(emp), 0) / empleados.length)
    : 0;

  const docsVencidos = empleados.reduce((sum, emp) => 
    sum + emp.employee_documents.filter(doc => isExpired(doc.expiry_date)).length, 0
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Documentación</h1>
          <p className="text-muted-foreground">
            Control de documentos obligatorios
          </p>
        </div>
        <div className="flex gap-4 items-center">
          <Card className="px-4 py-2">
            <div className="text-sm text-muted-foreground">Compliance Global</div>
            <div className="text-2xl font-bold">{globalCompliance}%</div>
          </Card>
          {docsVencidos > 0 && (
            <Badge variant="destructive" className="text-base px-4 py-2">
              <AlertCircle className="h-4 w-4 mr-2" />
              {docsVencidos} Documentos Caducados
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="produccion">Producción</SelectItem>
            <SelectItem value="logistica">Logística</SelectItem>
            <SelectItem value="compras">Compras</SelectItem>
            <SelectItem value="rrhh">RRHH</SelectItem>
            <SelectItem value="comercial">Comercial</SelectItem>
            <SelectItem value="administrativo">Administrativo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="completos">100% Completos</SelectItem>
            <SelectItem value="incompletos">Incompletos</SelectItem>
            <SelectItem value="caducados">Con Caducados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredEmpleados.map((empleado) => {
          const compliance = calculateCompliance(empleado);
          
          return (
            <Card key={empleado.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">{empleado.full_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {empleado.employee_code} · {empleado.department}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Compliance</div>
                    <div className="text-2xl font-bold">{compliance}%</div>
                  </div>
                  <Progress value={compliance} className="w-32" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {REQUIRED_DOCUMENTS.map((reqDoc) => {
                  const { badge, doc } = getDocumentStatus(empleado, reqDoc.type);
                  
                  return (
                    <div key={reqDoc.type} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {badge}
                        </div>
                        <p className="text-sm font-medium">{reqDoc.label}</p>
                        {doc?.expiry_date && (
                          <p className="text-xs text-muted-foreground">
                            Caduca: {format(new Date(doc.expiry_date), 'd MMM yyyy', { locale: es })}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {doc ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(doc.file_url, '_blank')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.pdf,.jpg,.jpeg,.png';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) handleUploadDocument(empleado.id, reqDoc.type, file);
                                };
                                input.click();
                              }}
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = '.pdf,.jpg,.jpeg,.png';
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) handleUploadDocument(empleado.id, reqDoc.type, file);
                              };
                              input.click();
                            }}
                          >
                            <Upload className="h-4 w-4 mr-1" />
                            Subir
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {filteredEmpleados.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No se encontraron empleados
        </div>
      )}
    </div>
  );
};
