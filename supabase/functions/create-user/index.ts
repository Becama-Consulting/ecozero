import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const authHeader = req.headers.get('Authorization');

    if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
      console.error('Missing environment variables');
      return new Response(
        JSON.stringify({ error: 'Configuración del servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'No autorizado - token faltante' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !requestingUser) {
      console.error('Auth verification failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'No autorizado - sesión inválida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', requestingUser.id, requestingUser.email);

    const { data: requestingUserRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id);

    if (rolesError) {
      console.error('Error fetching roles:', rolesError.message);
      return new Response(
        JSON.stringify({ error: 'Error al verificar permisos del usuario' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Requesting user roles:', requestingUserRoles);

    const { data: requestingUserProfile } = await supabaseAdmin
      .from('profiles')
      .select('departamento')
      .eq('id', requestingUser.id)
      .single();

    const isAdminGlobal = requestingUserRoles?.some((r: any) => r.role === 'admin_global');
    const isAdminDepartamento = requestingUserRoles?.some((r: any) => r.role === 'admin_departamento');
    const isSupervisor = requestingUserRoles?.some((r: any) => r.role === 'supervisor');

    if (!isAdminGlobal && !isAdminDepartamento && !isSupervisor) {
      return new Response(
        JSON.stringify({ error: 'No tienes permisos para crear usuarios' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let email, password, name, departamento, role;
    
    try {
      const body = await req.json();
      email = body.email;
      password = body.password;
      name = body.name;
      departamento = body.departamento;
      role = body.role;
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Formato de datos inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Formato de email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validRoles = ['admin_global', 'admin_departamento', 'supervisor', 'operario', 'quality'];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Rol inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isSupervisor && !isAdminGlobal && !isAdminDepartamento) {
      if (role !== 'operario' || departamento !== requestingUserProfile?.departamento) {
        return new Response(
          JSON.stringify({ error: 'Los supervisores solo pueden crear operarios en su departamento' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (isAdminDepartamento && !isAdminGlobal) {
      if (departamento !== requestingUserProfile?.departamento || ['admin_global', 'admin_departamento'].includes(role)) {
        return new Response(
          JSON.stringify({ error: 'No tienes permisos para esta acción' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    if (existingUsers?.users?.some((u: any) => u.email?.toLowerCase() === email.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Este email ya está registrado' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating user:', { email, name, departamento, role });

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (createError || !newUser?.user) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: `Error al crear usuario: ${createError?.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = newUser.user.id;
    console.log('✓ Auth user created:', userId);

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: userId, email, name, departamento: departamento || null });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Error al crear perfil: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✓ Profile created');

    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role });

    if (roleError) {
      console.error('Error assigning role:', roleError);
      await supabaseAdmin.from('profiles').delete().eq('id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Error al asignar rol: ${roleError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✓ Role assigned');

    await supabaseAdmin.from('activity_log').insert({
      user_id: requestingUser.id,
      action: 'create_user',
      table_name: 'profiles',
      record_id: userId,
      new_values: { email, name, departamento, role }
    });

    console.log('✓✓✓ User created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: userId, email, name, departamento: departamento || null, role },
        message: 'Usuario creado exitosamente'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Error inesperado al crear usuario' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
