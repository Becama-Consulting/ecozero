import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Eye, FileText, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Ausencia = {
  id: string;
  employee_id: string;
  absence_type: string;
  start_date: string;
  end_date: string;
  total_days: number | null;
  reason: string | null;
  document_url: string | null;
  document_validated: boolean;
  document_ai_check: any;
  status: string;
  employees: {
    employee_code: string;
    full_name: string;
    department: string;
  };
};

export const Ausencias = () => {
  const { user, userRoles, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [filteredAusencias, setFilteredAusencias] = useState<Ausencia[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [selectedAusencia, setSelectedAusencia] = useState<Ausencia | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [validatingIA, setValidatingIA] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

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

  // Cargar ausencias
  useEffect(() => {
    if (!loading && user) {
      loadAusencias();
    }
  }, [loading, user]);

  // Aplicar filtros
  useEffect(() => {
    let filtered = ausencias;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(a => a.status === filterStatus);
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(a => a.absence_type === filterType);
    }

    setFilteredAusencias(filtered);
  }, [ausencias, filterStatus, filterType]);

  const loadAusencias = async () => {
    try {
      const { data, error } = await supabase
        .from('absences')
        .select(`
          *,
          employees (
            employee_code,
            full_name,
            department
          )
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setAusencias(data || []);
    } catch (error) {
      console.error('Error cargando ausencias:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las ausencias',
        variant: 'destructive'
      });
    }
  };

  const handleViewDetail = (ausencia: Ausencia) => {
    setSelectedAusencia(ausencia);
    setShowDetailModal(true);
  };

  const validateDocumentWithIA = async (documentUrl: string) => {
    setValidatingIA(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-document-ia', {
        body: { documentUrl }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error validando documento:', error);
      toast({
        title: 'Error',
        description: 'No se pudo validar el documento con IA',
        variant: 'destructive'
      });
      return null;
    } finally {
      setValidatingIA(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedAusencia) return;

    try {
      // Si tiene documento y no está validado, validar con IA
      if (selectedAusencia.document_url && !selectedAusencia.document_validated) {
        const validation = await validateDocumentWithIA(selectedAusencia.document_url);
        
        if (validation?.isFake) {
          toast({
            title: '⚠️ ALERTA: Documento Sospechoso',
            description: 'El documento parece haber sido manipulado. Revisa manualmente antes de aprobar.',
            variant: 'destructive'
          });
          return;
        }

        // Actualizar validación IA
        await supabase
          .from('absences')
          .update({ 
            document_validated: true,
            document_ai_check: validation,
            ai_validated_at: new Date().toISOString()
          })
          .eq('id', selectedAusencia.id);
      }

      // Aprobar ausencia
      const { error } = await supabase
        .from('absences')
        .update({ 
          status: 'aprobado',
          approved_by: user!.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', selectedAusencia.id);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Ausencia aprobada correctamente'
      });

      setShowDetailModal(false);
      loadAusencias();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo aprobar la ausencia',
        variant: 'destructive'
      });
    }
  };

  const handleReject = async () => {
    if (!selectedAusencia || !rejectionReason) {
      toast({
        title: 'Error',
        description: 'Debes proporcionar un motivo de rechazo',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('absences')
        .update({ 
          status: 'rechazado',
          rejection_reason: rejectionReason,
          approved_by: user!.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', selectedAusencia.id);

      if (error) throw error;

      toast({
        title: 'Ausencia rechazada',
        description: 'Se ha notificado al empleado'
      });

      setShowDetailModal(false);
      setRejectionReason('');
      loadAusencias();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo rechazar la ausencia',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pendiente: { variant: 'secondary' as const, label: '⏳ Pendiente' },
      aprobado: { variant: 'default' as const, label: '✅ Aprobado' },
      rechazado: { variant: 'destructive' as const, label: '❌ Rechazado' }
    };

    const config = variants[status as keyof typeof variants] || variants.pendiente;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      vacaciones: 'Vacaciones',
      baja_medica: 'Baja Médica',
      permiso_retribuido: 'Permiso Retribuido',
      permiso_no_retribuido: 'Permiso No Retribuido',
      ausencia_injustificada: 'Ausencia Injustificada',
      excedencia: 'Excedencia'
    };

    return <Badge variant="outline">{labels[type] || type}</Badge>;
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
      <div>
        <h1 className="text-3xl font-bold">Ausencias</h1>
        <p className="text-muted-foreground">
          Gestión de ausencias, vacaciones y bajas médicas
        </p>
      </div>

      {/* Filtros */}
      <div className="flex gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendientes</SelectItem>
            <SelectItem value="aprobado">Aprobados</SelectItem>
            <SelectItem value="rechazado">Rechazados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="vacaciones">Vacaciones</SelectItem>
            <SelectItem value="baja_medica">Baja Médica</SelectItem>
            <SelectItem value="permiso_retribuido">Permiso Retribuido</SelectItem>
            <SelectItem value="permiso_no_retribuido">Permiso No Retribuido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead>Hasta</TableHead>
              <TableHead>Días</TableHead>
              <TableHead>Justificante</TableHead>
              <TableHead>Validación IA</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAusencias.map((ausencia) => (
              <TableRow key={ausencia.id}>
                <TableCell className="font-medium">
                  {ausencia.employees.full_name}
                </TableCell>
                <TableCell>{getTypeBadge(ausencia.absence_type)}</TableCell>
                <TableCell>
                  {format(new Date(ausencia.start_date), 'd MMM yyyy', { locale: es })}
                </TableCell>
                <TableCell>
                  {format(new Date(ausencia.end_date), 'd MMM yyyy', { locale: es })}
                </TableCell>
                <TableCell>{ausencia.total_days || '-'}</TableCell>
                <TableCell>
                  {ausencia.document_url ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(ausencia.document_url!, '_blank')}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {ausencia.document_validated ? (
                    ausencia.document_ai_check?.isFake ? (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Sospechoso
                      </Badge>
                    ) : (
                      <Badge variant="default">✓ Validado</Badge>
                    )
                  ) : ausencia.document_url ? (
                    <Badge variant="secondary">Pendiente</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(ausencia.status)}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleViewDetail(ausencia)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredAusencias.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No se encontraron ausencias
        </div>
      )}

      {/* Modal detalle */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Ausencia</DialogTitle>
          </DialogHeader>

          {selectedAusencia && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Empleado</Label>
                  <p className="font-medium">{selectedAusencia.employees.full_name}</p>
                </div>
                <div>
                  <Label>Departamento</Label>
                  <p>{selectedAusencia.employees.department}</p>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <div>{getTypeBadge(selectedAusencia.absence_type)}</div>
                </div>
                <div>
                  <Label>Estado</Label>
                  <div>{getStatusBadge(selectedAusencia.status)}</div>
                </div>
                <div>
                  <Label>Desde - Hasta</Label>
                  <p>
                    {format(new Date(selectedAusencia.start_date), 'd MMM', { locale: es })} - 
                    {format(new Date(selectedAusencia.end_date), 'd MMM yyyy', { locale: es })}
                  </p>
                </div>
                <div>
                  <Label>Total días</Label>
                  <p className="font-bold text-lg">{selectedAusencia.total_days || '-'}</p>
                </div>
              </div>

              {selectedAusencia.reason && (
                <div>
                  <Label>Motivo</Label>
                  <p className="text-sm">{selectedAusencia.reason}</p>
                </div>
              )}

              {selectedAusencia.document_url && (
                <div>
                  <Label>Justificante</Label>
                  <Button
                    variant="outline"
                    onClick={() => window.open(selectedAusencia.document_url!, '_blank')}
                  >
                    Ver documento
                  </Button>
                  {selectedAusencia.document_ai_check?.isFake && (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
                      <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                        ⚠️ Documento marcado como sospechoso por IA
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                        Motivos: {selectedAusencia.document_ai_check.reasons?.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedAusencia.status === 'pendiente' && (
                <div className="space-y-3">
                  <Label>Motivo de rechazo (opcional)</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Escribe el motivo si vas a rechazar..."
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedAusencia?.status === 'pendiente' && (
              <>
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={validatingIA}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Rechazar
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={validatingIA}
                >
                  {validatingIA ? (
                    'Validando IA...'
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Aprobar
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
