-- Agregar campo para códigos de respaldo 2FA
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS backup_codes text[];

-- Comentario para documentar el campo
COMMENT ON COLUMN profiles.backup_codes IS 'Array de códigos de respaldo para 2FA (encriptados). Cada código puede usarse una sola vez.';
