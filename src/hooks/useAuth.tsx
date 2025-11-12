import { useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UserRole {
  role: "admin_global" | "admin_departamento" | "supervisor" | "operario" | "quality";
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Defer role fetching with setTimeout to prevent deadlock
        setTimeout(() => {
          fetchUserRoles(session.user.id);
        }, 0);
      } else {
        setUserRoles([]);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRoles(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) throw error;
      
      setUserRoles(data || []);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      setUserRoles([]);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
        },
      },
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error al registrarse",
        description: error.message,
      });
      return { error };
    }

    toast({
      title: "Registro exitoso",
      description: "Puedes iniciar sesión ahora",
    });

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error al iniciar sesión",
        description: error.message,
      });
      return { error };
    }

    return { error: null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Error al cerrar sesión",
        description: error.message,
      });
    } else {
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
    }
  };

  const hasRole = useCallback((role: UserRole["role"]) => {
    return userRoles.some((r) => r.role === role);
  }, [userRoles]);

  const isAdmin = useCallback(() => {
    return userRoles.some(
      (r) => r.role === "admin_global" || r.role === "admin_departamento"
    );
  }, [userRoles]);

  const getDashboardByRole = useCallback(async () => {
    if (!user || userRoles.length === 0) return '/auth';
    
    // Admin global ve selector de módulos
    if (userRoles.some(r => r.role === 'admin_global')) {
      return '/';
    }
    
    // Para otros roles, obtener departamento del perfil
    const { data: profile } = await supabase
      .from('profiles')
      .select('departamento')
      .eq('id', user.id)
      .maybeSingle();
    
    const departamento = profile?.departamento;
    
    // Admin departamento va a su dashboard
    if (userRoles.some(r => r.role === 'admin_departamento')) {
      switch(departamento) {
        case 'produccion': return '/dashboard/produccion';
        case 'logistica': return '/dashboard/logistica';
        case 'compras': return '/dashboard/compras';
        case 'rrhh': return '/dashboard/rrhh';
        case 'comercial': return '/dashboard/comercial';
        case 'administrativo': return '/dashboard/administrativo';
        default: return '/dashboard/produccion';
      }
    }
    
    // Supervisor va a su área
    if (userRoles.some(r => r.role === 'supervisor')) {
      switch(departamento) {
        case 'produccion': return '/dashboard/produccion';
        case 'logistica': return '/dashboard/logistica';
        case 'compras': return '/dashboard/compras';
        case 'rrhh': return '/dashboard/rrhh';
        case 'comercial': return '/dashboard/comercial';
        case 'administrativo': return '/dashboard/administrativo';
        default: return '/dashboard/produccion';
      }
    }
    
    // Operario y quality van a producción
    if (userRoles.some(r => r.role === 'operario' || r.role === 'quality')) {
      return '/dashboard/produccion';
    }
    
    return '/';
  }, [user, userRoles]);

  return {
    user,
    session,
    loading,
    userRoles,
    signUp,
    signIn,
    signOut,
    hasRole,
    isAdmin,
    getDashboardByRole,
  };
};