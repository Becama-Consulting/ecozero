# 📋 INSTRUCCIONES: Crear Tablas RRHH en Supabase

## ❌ Tablas Faltantes (Errores 404)

El dashboard de RRHH está fallando porque **estas 8 tablas NO existen** en tu base de datos:

1. ✅ `employees` - Empleados
2. ✅ `attendance` - Fichajes/Asistencia  
3. ✅ `absences` - Ausencias
4. ✅ `shifts` - Turnos
5. ✅ `employee_documents` - Documentos de empleados
6. ✅ `payroll` - Nóminas
7. ✅ `ett_employees` - Empleados ETT (Empresas de Trabajo Temporal)
8. ✅ `ett_invoices` - Facturas ETT

---

## 🚀 OPCIÓN 1: Crear Tablas desde Supabase Dashboard (RECOMENDADO)

### Paso 1: Acceder a Supabase
1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto: `dqwqgvgfiyfmnybyxojc`

### Paso 2: Abrir SQL Editor
1. En el menú lateral izquierdo, haz clic en **"SQL Editor"**
2. Haz clic en **"New Query"**

### Paso 3: Copiar y Ejecutar el Script
1. Abre el archivo: `CREAR_TABLAS_RRHH.sql`
2. Copia **TODO** el contenido del archivo
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en **"Run"** (abajo a la derecha)

### Paso 4: Verificar
Después de ejecutar, ejecuta esta consulta para verificar:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'employees', 
  'attendance', 
  'absences', 
  'shifts', 
  'employee_documents', 
  'payroll', 
  'ett_employees', 
  'ett_invoices'
);
```

Deberías ver las 8 tablas listadas.

---

## 🔧 OPCIÓN 2: Crear Tablas desde Terminal (Avanzado)

Si tienes Supabase CLI instalado:

```bash
cd /Volumes/Proyectos/Trabajo/ecozero
supabase db push
```

O ejecutar el script manualmente:

```bash
psql -h dqwqgvgfiyfmnybyxojc.supabase.co \
     -U postgres \
     -d postgres \
     -f CREAR_TABLAS_RRHH.sql
```

---

## 📊 Estructura de las Tablas Creadas

### 1. **employees** (Empleados)
- `employee_code` - Código único del empleado
- `full_name` - Nombre completo
- `dni`, `email`, `phone` - Datos personales
- `position`, `department` - Puesto y departamento
- `contract_type` - Tipo de contrato
- `hire_date`, `termination_date` - Fechas
- `active` - Estado activo/inactivo

### 2. **attendance** (Fichajes)
- `employee_id` - Referencia al empleado
- `date` - Fecha del fichaje
- `check_in`, `check_out` - Hora entrada/salida
- `status` - Estado (completo, pendiente)

### 3. **absences** (Ausencias)
- `employee_id` - Referencia al empleado
- `type`, `absence_type` - Tipo de ausencia
- `start_date`, `end_date` - Período
- `status` - Estado (pendiente, aprobado, rechazado)
- `document_url` - URL del justificante
- `document_validated` - Validación AI

### 4. **shifts** (Turnos)
- `employee_id` - Referencia al empleado
- `date` - Fecha del turno
- `shift_type` - Tipo de turno
- `start_time`, `end_time` - Horario

### 5. **employee_documents** (Documentos)
- `employee_id` - Referencia al empleado
- `document_type` - Tipo de documento
- `file_url` - URL del archivo
- `expiry_date` - Fecha de caducidad
- `required` - Si es obligatorio
- `verified` - Si está verificado

### 6. **payroll** (Nóminas)
- `employee_id` - Referencia al empleado
- `period` - Período (YYYY-MM)
- `base_salary`, `extras`, `bonuses` - Conceptos
- `deductions` - Deducciones
- `gross_salary`, `net_salary` - Salario bruto/neto
- `has_discrepancies`, `discrepancies` - Control de errores

### 7. **ett_employees** (Empleados ETT)
- `employee_id` - Referencia al empleado
- `agency` - Agencia ETT
- `contract_start`, `contract_end` - Período contrato
- `hourly_rate` - Tarifa por hora

### 8. **ett_invoices** (Facturas ETT)
- `agency` - Agencia ETT
- `invoice_number` - Número de factura
- `period_start`, `period_end` - Período facturado
- `total_amount` - Importe total
- `validated` - Si está validada
- `discrepancies` - Discrepancias encontradas

---

## 🔒 Seguridad (RLS)

Todas las tablas tienen **Row Level Security (RLS)** habilitado con estas políticas:

- ✅ **Lectura**: Todos los usuarios autenticados pueden ver los datos
- ✅ **Escritura**: Solo administradores (`admin_global`, `admin_departamento`)

---

## ✅ Después de Crear las Tablas

1. **Recarga la aplicación**: Presiona `Ctrl+Shift+R` (hard reload)
2. **Verifica el dashboard RRHH**: Debería cargar sin errores 404
3. **Datos de ejemplo**: Se creará 1 empleado de ejemplo automáticamente

---

## 🆘 Si hay Errores

### Error: "function is_admin does not exist"
El script ya incluye la creación de esta función. Si falla, verifica que tengas permisos.

### Error: "relation already exists"
Algunas tablas ya existen. El script usa `CREATE TABLE IF NOT EXISTS` y `DROP POLICY IF EXISTS`, así que es seguro ejecutarlo múltiples veces.

### Error de permisos
Asegúrate de estar usando el usuario `postgres` con permisos de administrador.

---

## 📝 Migración Futura

Para mantener el código sincronizado, crea una migración:

```bash
cd /Volumes/Proyectos/Trabajo/ecozero
supabase migration new create_rrhh_tables
# Copia el contenido de CREAR_TABLAS_RRHH.sql al nuevo archivo
```

---

**¿Todo listo?** Ejecuta el script SQL y el dashboard RRHH funcionará perfectamente. 🚀
