-- Ver estructura de la tabla fabrication_orders
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'fabrication_orders'
ORDER BY ordinal_position;

-- Ver estructura de la tabla bom_items (si existe)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'bom_items'
ORDER BY ordinal_position;

-- Ver estructura de la tabla of_etapas (si existe)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'of_etapas'
ORDER BY ordinal_position;

-- Ver estructura de la tabla production_steps
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'production_steps'
ORDER BY ordinal_position;

-- Listar todas las tablas relacionadas con producción
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND (table_name LIKE '%fabrication%' 
    OR table_name LIKE '%production%' 
    OR table_name LIKE '%bom%'
    OR table_name LIKE '%of_%'
    OR table_name LIKE '%pedido%')
ORDER BY table_name;
