-- Policy para que usuarios lean sus propios roles
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Insertar líneas de producción iniciales
INSERT INTO public.production_lines (name, capacity, status) VALUES
  ('ECONORDIK', 8, 'active'),
  ('QUADRILATERAL', 8, 'active')
ON CONFLICT (name) DO NOTHING;