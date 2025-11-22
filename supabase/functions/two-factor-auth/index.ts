/**
 * Supabase Edge Function: two-factor-auth
 * 
 * Gestiona la autenticación de dos factores (2FA/TOTP):
 * 1. Generar secreto TOTP y QR code
 * 2. Validar código inicial para activar 2FA
 * 3. Verificar código durante el login
 * 4. Desactivar 2FA
 * 
 * Uso:
 * - POST /functions/v1/two-factor-auth
 *   Body: { action: 'generate' }
 *   Response: { secret: string, qrCode: string, backupCodes: string[] }
 * 
 * - POST /functions/v1/two-factor-auth
 *   Body: { action: 'enable', code: string, secret: string }
 *   Response: { success: boolean, backupCodes: string[] }
 * 
 * - POST /functions/v1/two-factor-auth
 *   Body: { action: 'verify', code: string }
 *   Response: { valid: boolean }
 * 
 * - POST /functions/v1/two-factor-auth
 *   Body: { action: 'disable', password: string }
 *   Response: { success: boolean }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "https://deno.land/x/otpauth@v9.1.4/dist/otpauth.esm.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generar códigos de respaldo aleatorios
function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    const code = Array.from(array, byte => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 8)
      .toUpperCase();
    codes.push(code.match(/.{1,4}/g)?.join('-') || code);
  }
  return codes;
}

// Generar secreto base32 aleatorio
function generateSecret(): string {
  const buffer = new Uint8Array(20);
  crypto.getRandomValues(buffer);
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  
  for (let i = 0; i < buffer.length; i++) {
    secret += base32chars[buffer[i] % 32];
  }
  
  return secret;
}

serve(async (req) => {
  // Manejar preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('❌ No Authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No autorizado - Header ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Crear cliente con las credenciales correctas
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('🔧 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      hasServiceKey: !!supabaseServiceKey,
      authHeaderPrefix: authHeader.substring(0, 20) + '...'
    });

    const supabaseClient = createClient(
      supabaseUrl ?? '',
      supabaseAnonKey ?? '',
      { 
        global: { 
          headers: { 
            Authorization: authHeader 
          } 
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const supabaseAdmin = createClient(
      supabaseUrl ?? '',
      supabaseServiceKey ?? ''
    );

    // Obtener usuario autenticado
    console.log('🔍 Attempting to get user from JWT...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    console.log('📊 GetUser result:', {
      success: !!user,
      userId: user?.id,
      userEmail: user?.email,
      errorMessage: userError?.message,
      errorStatus: userError?.status
    });
    
    if (userError || !user) {
      console.error('❌ Authentication failed:', userError);
      return new Response(
        JSON.stringify({ 
          error: 'Usuario no autenticado', 
          details: userError?.message || 'Token inválido'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ User authenticated: ${user.email} (${user.id})`);

    const body = await req.json();
    const { action, code, secret, password } = body;

    console.log(`📥 Request action: ${action}`);

    // ==========================================
    // ACCIÓN 1: Generar secreto y QR code
    // ==========================================
    if (action === 'generate') {
      // Verificar que el usuario no tenga 2FA ya activado
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('two_factor_enabled')
        .eq('id', user.id)
        .single();

      if (profile?.two_factor_enabled) {
        return new Response(
          JSON.stringify({ error: '2FA ya está activado. Desactívalo primero para regenerar.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generar secreto base32
      const newSecret = generateSecret();
      
      // Crear instancia TOTP con Secret como objeto
      const totp = new OTPAuth.TOTP({
        issuer: 'EcoCERO',
        label: user.email || 'Usuario',
        algorithm: 'SHA1',
        digits: 6,
        period: 60,
        secret: OTPAuth.Secret.fromBase32(newSecret),
      });

      // Generar URI para el QR code
      const otpauthUrl = totp.toString();

      // Generar códigos de respaldo
      const backupCodes = generateBackupCodes(8);

      console.log(`Secreto 2FA generado para usuario ${user.id}`);

      return new Response(
        JSON.stringify({
          secret: newSecret,
          qrCodeUrl: otpauthUrl,
          backupCodes: backupCodes,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // ACCIÓN 2: Activar 2FA (validar código inicial)
    // ==========================================
    if (action === 'enable') {
      if (!code || !secret) {
        console.error('❌ Código o secreto faltante:', { hasCode: !!code, hasSecret: !!secret });
        return new Response(
          JSON.stringify({ error: 'Código y secreto requeridos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('🔐 Validando código 2FA:', {
        userId: user.id,
        codeLength: code.length,
        secretLength: secret.length,
        secretPrefix: secret.substring(0, 4) + '...'
      });

      // Crear instancia TOTP con el secreto proporcionado como objeto Secret
      const totp = new OTPAuth.TOTP({
        issuer: 'EcoCERO',
        label: user.email || 'Usuario',
        algorithm: 'SHA1',
        digits: 6,
        period: 60,
        secret: OTPAuth.Secret.fromBase32(secret),
      });

      // Generar el código actual para debugging
      const currentCode = totp.generate();
      console.log('📱 Código esperado:', currentCode);
      console.log('📥 Código recibido:', code);

      // Validar código con ventana de +/- 2 periodos (150 segundos total = 5 minutos)
      const delta = totp.validate({ token: code, window: 2 });

      console.log('✅ Resultado validación:', { delta, isValid: delta !== null });

      if (delta === null) {
        console.error('❌ Código inválido');
        return new Response(
          JSON.stringify({ success: false, error: 'Código inválido o expirado. Intenta con el código actual.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generar códigos de respaldo
      const backupCodes = generateBackupCodes(8);

      // Guardar secreto y activar 2FA en el perfil
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          two_factor_enabled: true,
          two_factor_secret: secret,
          backup_codes: backupCodes, // Necesitarás añadir este campo a la tabla si quieres almacenar códigos de respaldo
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error activando 2FA:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al activar 2FA' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`2FA activado para usuario ${user.id}`);

      return new Response(
        JSON.stringify({
          success: true,
          backupCodes: backupCodes,
          message: '2FA activado correctamente',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // ACCIÓN 3: Verificar código 2FA (durante login)
    // ==========================================
    if (action === 'verify') {
      if (!code) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Código requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Obtener secreto del usuario
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('two_factor_secret, two_factor_enabled, backup_codes')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.two_factor_enabled || !profile?.two_factor_secret) {
        return new Response(
          JSON.stringify({ valid: false, error: '2FA no configurado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar si es un código de respaldo
      if (profile.backup_codes && profile.backup_codes.includes(code)) {
        // Remover el código de respaldo usado
        const updatedBackupCodes = profile.backup_codes.filter((bc: string) => bc !== code);
        
        await supabaseAdmin
          .from('profiles')
          .update({ backup_codes: updatedBackupCodes })
          .eq('id', user.id);

        console.log(`Código de respaldo usado por usuario ${user.id}`);

        return new Response(
          JSON.stringify({ valid: true, usedBackupCode: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar código TOTP
      const totp = new OTPAuth.TOTP({
        issuer: 'EcoCERO',
        label: user.email || 'Usuario',
        algorithm: 'SHA1',
        digits: 6,
        period: 60,
        secret: OTPAuth.Secret.fromBase32(profile.two_factor_secret),
      });

      const delta = totp.validate({ token: code, window: 1 });

      if (delta === null) {
        console.log(`Código 2FA inválido para usuario ${user.id}`);
        return new Response(
          JSON.stringify({ valid: false, error: 'Código inválido o expirado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Código 2FA válido para usuario ${user.id}`);

      return new Response(
        JSON.stringify({ valid: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // ACCIÓN 4: Desactivar 2FA
    // ==========================================
    if (action === 'disable') {
      if (!password) {
        return new Response(
          JSON.stringify({ error: 'Contraseña requerida para desactivar 2FA' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar contraseña del usuario
      const { error: signInError } = await supabaseClient.auth.signInWithPassword({
        email: user.email!,
        password: password,
      });

      if (signInError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Contraseña incorrecta' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Desactivar 2FA
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          two_factor_enabled: false,
          two_factor_secret: null,
          backup_codes: null,
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error desactivando 2FA:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al desactivar 2FA' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`2FA desactivado para usuario ${user.id}`);

      return new Response(
        JSON.stringify({ success: true, message: '2FA desactivado correctamente' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Acción no reconocida
    return new Response(
      JSON.stringify({ error: 'Acción no válida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en two-factor-auth:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
