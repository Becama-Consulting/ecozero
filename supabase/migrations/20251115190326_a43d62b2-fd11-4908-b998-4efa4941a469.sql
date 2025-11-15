-- Crear tabla empleados ETT
CREATE TABLE IF NOT EXISTS public.ett_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  agency TEXT NOT NULL,
  contract_start DATE NOT NULL,
  contract_end DATE,
  hourly_rate NUMERIC(10,2) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear tabla facturas ETT
CREATE TABLE IF NOT EXISTS public.ett_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  extracted_data JSONB,
  validated BOOLEAN DEFAULT false,
  discrepancies JSONB DEFAULT '[]'::jsonb,
  validated_by UUID,
  validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(invoice_number)
);

-- Actualizar tabla employee_documents para añadir campos faltantes
ALTER TABLE public.employee_documents 
  ADD COLUMN IF NOT EXISTS document_name TEXT,
  ADD COLUMN IF NOT EXISTS issue_date DATE,
  ADD COLUMN IF NOT EXISTS file_size INTEGER,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'entregado',
  ADD COLUMN IF NOT EXISTS uploaded_by UUID;

-- Habilitar RLS
ALTER TABLE public.ett_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ett_invoices ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ett_employees
CREATE POLICY "Authenticated users can view ETT employees"
  ON public.ett_employees FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage ETT employees"
  ON public.ett_employees FOR ALL
  USING (is_admin(auth.uid()));

-- Políticas RLS para ett_invoices
CREATE POLICY "Authenticated users can view ETT invoices"
  ON public.ett_invoices FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage ETT invoices"
  ON public.ett_invoices FOR ALL
  USING (is_admin(auth.uid()));

-- Crear buckets de storage
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('employee-documents', 'employee-documents', false),
  ('ett-invoices', 'ett-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para employee-documents
CREATE POLICY "Authenticated users can view employee documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'employee-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can upload employee documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'employee-documents' AND is_admin(auth.uid()));

-- Políticas de storage para ett-invoices
CREATE POLICY "Authenticated users can view ETT invoices"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ett-invoices' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can upload ETT invoices"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ett-invoices' AND is_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_ett_employees_updated_at
  BEFORE UPDATE ON public.ett_employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ett_invoices_updated_at
  BEFORE UPDATE ON public.ett_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();