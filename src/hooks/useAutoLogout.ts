import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para cerrar sesión automáticamente cuando el usuario cierra la pestaña/ventana
 * o recarga la página (medida de seguridad para entornos corporativos)
 */
export const useAutoLogout = () => {
  useEffect(() => {
    // Cerrar sesión cuando se cierra la pestaña/ventana
    const handleBeforeUnload = async () => {
      // Usar sendBeacon para garantizar que se ejecute incluso al cerrar
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Cerrar sesión de forma síncrona
        await supabase.auth.signOut();
      }
    };

    // Detectar cierre de pestaña/ventana
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Limpiar al desmontar
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
};
