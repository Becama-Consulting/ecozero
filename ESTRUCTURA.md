# 📁 Estructura del Proyecto - EcoZero

## Organización por Departamentos

El proyecto está organizado en módulos por departamento para facilitar el trabajo en equipo:

### 📂 `src/pages/`

#### `/auth` - Autenticación
- `Auth.tsx` - Página de login
- `Index.tsx` - Landing page/redirección inicial

#### `/admin` - Administración Global  
- `AdminUsers.tsx` - Gestión de usuarios del sistema
- `DashboardGlobal.tsx` - Dashboard principal de administración

#### `/produccion` - Departamento de Producción
- `DashboardProduccion.tsx` - Dashboard de producción
- `FichaOF.tsx` - Detalle de órdenes de fabricación
- `DetalleLinea.tsx` - Detalle de líneas de producción
- `Alertas.tsx` - Sistema de alertas de producción

#### `/rrhh` - Recursos Humanos (Próximamente)
- Dashboard de RRHH
- Gestión de fichajes
- Control de turnos
- Nóminas

### 📂 `src/components/`

#### `/auth` - Componentes de autenticación
- `ProtectedRoute.tsx` - HOC para rutas protegidas

#### `/admin` - Componentes de administración
- `GenerateCredentialsModal.tsx` - Modal para generar credenciales
- `UserCredentialsModal.tsx` - Modal para mostrar credenciales

#### `/produccion` - Componentes de producción
- `CreateOFModal.tsx` - Modal para crear órdenes de fabricación
- `OFFilters.tsx` - Filtros para órdenes de fabricación
- `PhotoUpload.tsx` - Componente para subir fotos

#### `/shared` - Componentes compartidos
- `NavLink.tsx` - Componente de navegación

#### `/ui` - Componentes UI base (shadcn/ui)
- Componentes reutilizables de interfaz

## Convenciones de Importación

Usar imports desde los index para mayor limpieza:

```typescript
// ✅ Correcto
import { AdminUsers, DashboardGlobal } from '@/pages/admin';
import { CreateOFModal, OFFilters } from '@/components/produccion';

// ❌ Evitar (pero funcional)
import AdminUsers from '@/pages/admin/AdminUsers';
import { CreateOFModal } from '@/components/produccion/CreateOFModal';
```

## Añadir Nuevos Módulos

1. Crear carpeta en `pages/` y `components/` con nombre del departamento
2. Crear archivo `index.ts` para exportaciones
3. Actualizar este README
4. Actualizar rutas en `App.tsx` si es necesario
