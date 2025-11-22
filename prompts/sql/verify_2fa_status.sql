-- Verificar estado actual de 2FA para usuario dennis@becamaconsulting.com
SELECT 
  id,
  email,
  two_factor_enabled,
  two_factor_secret IS NOT NULL as has_secret,
  backup_codes IS NOT NULL as has_backup_codes,
  created_at
FROM profiles 
WHERE email = 'dennis@becamaconsulting.com';

-- Para habilitar 2FA manualmente (solo para pruebas - normalmente se hace desde la app):
-- UPDATE profiles 
-- SET 
--   two_factor_enabled = true,
--   two_factor_secret = 'JBSWY3DPEHPK3PXP',  -- Ejemplo, debes generar uno real
--   backup_codes = ARRAY['1234-5678', '8765-4321']  -- Ejemplo
-- WHERE email = 'dennis@becamaconsulting.com';
