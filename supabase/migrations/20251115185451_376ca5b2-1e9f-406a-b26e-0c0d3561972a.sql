-- Agregar columnas de validación IA a tabla absences
ALTER TABLE public.absences 
  ADD COLUMN IF NOT EXISTS absence_type TEXT DEFAULT 'vacaciones',
  ADD COLUMN IF NOT EXISTS total_days INTEGER,
  ADD COLUMN IF NOT EXISTS document_url TEXT,
  ADD COLUMN IF NOT EXISTS document_validated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS document_ai_check JSONB,
  ADD COLUMN IF NOT EXISTS ai_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Crear tabla payroll (nóminas)
CREATE TABLE IF NOT EXISTS public.payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  period TEXT NOT NULL,
  base_salary DECIMAL(10,2) DEFAULT 0,
  extras DECIMAL(10,2) DEFAULT 0,
  bonuses DECIMAL(10,2) DEFAULT 0,
  deductions DECIMAL(10,2) DEFAULT 0,
  gross_salary DECIMAL(10,2) DEFAULT 0,
  net_salary DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'borrador',
  has_discrepancies BOOLEAN DEFAULT false,
  discrepancies JSONB DEFAULT '[]'::jsonb,
  advisor_data JSONB,
  internal_data JSONB,
  validated_at TIMESTAMPTZ,
  validated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, period)
);

-- Índices para payroll
CREATE INDEX IF NOT EXISTS idx_payroll_period ON public.payroll(period);
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON public.payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_discrepancies ON public.payroll(has_discrepancies) WHERE has_discrepancies = true;

-- RLS para payroll
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payroll"
  ON public.payroll FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage payroll"
  ON public.payroll FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- Trigger para payroll updated_at
CREATE TRIGGER update_payroll_updated_at
  BEFORE UPDATE ON public.payroll
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();