import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, UserX } from 'lucide-react';

type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  dni: string;
  email: string;
  position: string;
  department: string;
  contract_type: string;
  hire_date: string;
  active: boolean;
};

export const Empleados = () => {
  const { user, userRoles, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [empleados, setEmpleados] = useState<Employee[]>([]);
  const [filteredEmpleados, setFilteredEmpleados] = useState<Employee[]>([]);
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Verificar permisos
  useEffect(() => {
    if (!loading && user) {
      const hasAccess = userRoles.some(r => 
        r.role === 'admin_global' || 
        (r.role === 'admin_departamento')
      );
      
      if (!hasAccess) {
        navigate('/dashboard/produccion');
      }
    }
  }, [loading, user, userRoles, navigate]);

  // Cargar empleados
  useEffect(() => {
    if (!loading && user) {
      loadEmpleados();
    }
  }, [loading, user]);

  // Aplicar filtros
  useEffect(() => {
    let filtered = empleados;

    if (filterDept !== 'all') {
      filtered = filtered.filter(emp => emp.department === filterDept);
    }

    if (filterStatus !== 'all') {
      const isActive = filterStatus === 'active';
      filtered = filtered.filter(emp => emp.active === isActive);
    }

    if (searchTerm) {
      filtered = filtered.filter(emp => 
        emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.dni.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredEmpleados(filtered);
  }, [empleados, filterDept, filterStatus, searchTerm]);

  const loadEmpleados = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('full_name');

      if (error) throw error;
      setEmpleados(data || []);
    } catch (error) {
      console.error('Error cargando empleados:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los empleados',
        variant: 'destructive'
      });
    }
  };

  const handleCreateEmployee = () => {
    toast({
      title: 'Próximamente',
      description: 'Funcionalidad de crear empleado en desarrollo'
    });
  };

  const handleEditEmployee = (employee: Employee) => {
    toast({
      title: 'Próximamente',
      description: 'Funcionalidad de editar empleado en desarrollo'
    });
  };

  const handleDeactivateEmployee = async (employeeId: string) => {
    if (!confirm('¿Estás seguro de dar de baja a este empleado?')) return;

    try {
      const { error } = await supabase
        .from('employees')
        .update({ active: false, termination_date: new Date().toISOString().split('T')[0] })
        .eq('id', employeeId);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Empleado dado de baja correctamente'
      });

      loadEmpleados();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo dar de baja al empleado',
        variant: 'destructive'
      });
    }
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
          <h1 className="text-3xl font-bold">Empleados</h1>
          <p className="text-muted-foreground">Gestión de personal</p>
        </div>
        <Button onClick={handleCreateEmployee}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Empleado
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 flex-wrap">
        <Input
          placeholder="Buscar por nombre, DNI o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />

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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Puesto</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Tipo Contrato</TableHead>
              <TableHead>F. Alta</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmpleados.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell className="font-mono">{emp.employee_code}</TableCell>
                <TableCell className="font-medium">{emp.full_name}</TableCell>
                <TableCell>{emp.dni}</TableCell>
                <TableCell>{emp.email}</TableCell>
                <TableCell>{emp.position}</TableCell>
                <TableCell>
                  <Badge variant="outline">{emp.department}</Badge>
                </TableCell>
                <TableCell>{emp.contract_type}</TableCell>
                <TableCell>{new Date(emp.hire_date).toLocaleDateString('es-ES')}</TableCell>
                <TableCell>
                  <Badge variant={emp.active ? 'default' : 'secondary'}>
                    {emp.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditEmployee(emp)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {emp.active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeactivateEmployee(emp.id)}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredEmpleados.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No se encontraron empleados
        </div>
      )}
    </div>
  );
};
