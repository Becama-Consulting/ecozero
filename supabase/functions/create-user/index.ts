import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create regular client for auth verification
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Verify the requesting user is authenticated
    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !requestingUser) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get requesting user's roles
    const { data: requestingUserRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id);

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Error al verificar permisos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get requesting user's department
    const { data: requestingUserProfile } = await supabaseAdmin
      .from('profiles')
      .select('departamento')
      .eq('id', requestingUser.id)
      .single();

    const isAdminGlobal = requestingUserRoles?.some(r => r.role === 'admin_global');
    const isAdminDepartamento = requestingUserRoles?.some(r => r.role === 'admin_departamento');
    const isSupervisor = requestingUserRoles?.some(r => r.role === 'supervisor');

    if (!isAdminGlobal && !isAdminDepartamento && !isSupervisor) {
      return new Response(
        JSON.stringify({ error: 'No tienes permisos para crear usuarios' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { email, password, name, departamento, role } = await req.json();

    // Validate input
    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify permissions based on role hierarchy
    if (isSupervisor && !isAdminGlobal && !isAdminDepartamento) {
      // Supervisors can only create operarios in their department
      if (role !== 'operario') {
        return new Response(
          JSON.stringify({ error: 'Los supervisores solo pueden crear operarios' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (departamento !== requestingUserProfile?.departamento) {
        return new Response(
          JSON.stringify({ error: 'Solo puedes crear usuarios en tu departamento' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (isAdminDepartamento && !isAdminGlobal) {
      // Admin departamento can create in their department but not other admins
      if (departamento !== requestingUserProfile?.departamento) {
        return new Response(
          JSON.stringify({ error: 'Solo puedes crear usuarios en tu departamento' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (role === 'admin_global' || role === 'admin_departamento') {
        return new Response(
          JSON.stringify({ error: 'No puedes crear otros administradores' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(u => u.email === email);

    if (emailExists) {
      return new Response(
        JSON.stringify({ error: 'Este email ya está registrado' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating user:', { email, name, departamento, role });

    // Create user in Supabase Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { name }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: `Error al crear usuario: ${createError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: 'Error al crear usuario' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created in auth:', newUser.user.id);

    // Update profile (trigger already created it)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        email,
        name,
        departamento: departamento || null
      })
      .eq('id', newUser.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: `Error al actualizar perfil: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile updated for user:', newUser.user.id);

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role
      });

    if (roleError) {
      console.error('Error assigning role:', roleError);
      // Rollback: delete profile and auth user
      await supabaseAdmin.from('profiles').delete().eq('id', newUser.user.id);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: `Error al asignar rol: ${roleError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Role assigned to user:', newUser.user.id);

    // Log activity
    await supabaseAdmin.from('activity_log').insert({
      user_id: requestingUser.id,
      action: 'create_user',
      table_name: 'profiles',
      record_id: newUser.user.id,
      new_values: { email, name, departamento, role }
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email,
          name,
          departamento,
          role
        }
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
