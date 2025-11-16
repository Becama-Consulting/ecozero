
  -- =============================================
-- POLÍTICAS DE STORAGE
-- =============================================

-- Políticas para storage de documentos de empleados
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can view employee documents'
  ) THEN
    CREATE POLICY "Authenticated users can view employee documents"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'employee-documents' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can upload employee documents'
  ) THEN
    CREATE POLICY "Admins can upload employee documents"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'employee-documents' AND is_admin(auth.uid()));
  END IF;

  -- Políticas para storage de facturas ETT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can view ETT invoices'
  ) THEN
    CREATE POLICY "Authenticated users can view ETT invoices"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'ett-invoices' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can upload ETT invoices'
  ) THEN
    CREATE POLICY "Admins can upload ETT invoices"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'ett-invoices' AND is_admin(auth.uid()));
  END IF;
END $$;

-- =============================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- =============================================

-- Insertar empleado de ejemplo
INSERT INTO public.employees (
  employee_code, 
  full_name, 
  dni, 
  email, 
  position, 
  department, 
  contract_type, 
  hire_date
) VALUES (
  'EMP001',
  'Juan Pérez García',
  '12345678A',
  'juan.perez@ecozero.com',
  'Operario',
  'produccion',
  'indefinido',
  '2024-01-15'
) ON CONFLICT (employee_code) DO NOTHING;

-- =============================================
-- VERIFICACIÓN
-- =============================================
-- Ejecuta esto después para verificar que todo se creó correctamente:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('employees', 'attendance', 'absences', 'shifts', 'employee_documents', 'payroll', 'ett_employees', 'ett_invoices');
