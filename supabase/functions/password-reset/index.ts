/**
 * Supabase Edge Function: password-reset
 * 
 * Gestiona el flujo completo de recuperación de contraseña:
 * 1. Solicitud de reset: genera token y envía email
 * 2. Validación de token: verifica que el token sea válido y no expirado
 * 3. Actualización de contraseña: cambia la contraseña usando token válido
 * 
 * Uso:
 * - POST /functions/v1/password-reset
 *   Body: { action: 'request', email: string }
 *   Response: { success: boolean, message: string }
 * 
 * - POST /functions/v1/password-reset
 *   Body: { action: 'validate', token: string }
 *   Response: { valid: boolean, userId?: string }
 * 
 * - POST /functions/v1/password-reset
 *   Body: { action: 'reset', token: string, newPassword: string }
 *   Response: { success: boolean, error?: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generar token aleatorio seguro de 32 caracteres
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Enviar email de recuperación usando Resend
async function sendPasswordResetEmail(
  supabaseAdmin: any,
  email: string,
  token: string
): Promise<boolean> {
  try {
    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:8080';
    const resetUrl = `${siteUrl}/auth/reset-password/${token}`;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    // Si no hay API key configurada, loguear en consola (desarrollo)
    if (!resendApiKey) {
      console.log('='.repeat(80));
      console.log('⚠️  RESEND_API_KEY no configurada - EMAIL EN CONSOLA (DESARROLLO)');
      console.log('='.repeat(80));
      console.log(`Para: ${email}`);
      console.log(`Link de recuperación: ${resetUrl}`);
      console.log('='.repeat(80));
      console.log('Para producción, configura RESEND_API_KEY en Supabase Secrets');
      console.log('='.repeat(80));
      return true;
    }
    
    // Enviar email usando Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'EcoCero <no-reply@ecocero.com>',
        to: email,
        subject: 'Recupera tu contraseña - EcoCero',
        html: `
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Recupera tu contraseña</title>
            <!--[if mso]>
            <noscript>
              <xml>
                <o:OfficeDocumentSettings>
                  <o:PixelsPerInch>96</o:PixelsPerInch>
                </o:OfficeDocumentSettings>
              </xml>
            </noscript>
            <![endif]-->
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8f9fa;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <!-- Main Container -->
                  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden; max-width: 600px;">
                    
                    <!-- Header with Logo -->
                    <tr>
                      <td align="center" style="padding: 48px 40px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="background-color: #ffffff; border-radius: 12px; padding: 16px 24px;">
                              <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #059669; letter-spacing: -0.5px;">
                                Eco<span style="color: #10b981;">CERO</span>
                              </h1>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 48px 40px;">
                        <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #111827; line-height: 1.3;">
                          Recupera tu contraseña
                        </h2>
                        
                        <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #6b7280;">
                          Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón de abajo para crear una nueva contraseña.
                        </p>
                        
                        <!-- CTA Button -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td align="center" style="padding: 8px 0 32px;">
                              <a href="${resetUrl}" 
                                 style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.3s ease;"
                                 target="_blank">
                                Restablecer mi contraseña
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Divider -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 32px 0;">
                          <tr>
                            <td style="border-top: 1px solid #e5e7eb;"></td>
                          </tr>
                        </table>
                        
                        <!-- Alternative Link -->
                        <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.5; color: #6b7280;">
                          Si el botón no funciona, copia y pega este enlace en tu navegador:
                        </p>
                        <p style="margin: 0 0 32px; padding: 16px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; word-break: break-all;">
                          <a href="${resetUrl}" style="color: #059669; text-decoration: none; font-size: 13px;" target="_blank">${resetUrl}</a>
                        </p>
                        
                        <!-- Warning Box -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b; overflow: hidden;">
                          <tr>
                            <td style="padding: 20px;">
                              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #92400e;">
                                <strong>⚠️ Nota importante:</strong> Este enlace expirará en <strong>1 hora</strong> por seguridad. Si no solicitaste este cambio, ignora este correo.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 32px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.5; color: #6b7280; text-align: center;">
                          Este correo fue enviado automáticamente. Por favor, no respondas a este mensaje.
                        </p>
                        <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9ca3af; text-align: center;">
                          © ${new Date().getFullYear()} <strong>EcoCERO</strong> · Sistema de Automatización Integral
                        </p>
                      </td>
                    </tr>
                    
                  </table>
                  
                  <!-- Footer Links (Outside card) -->
                  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin-top: 24px;">
                    <tr>
                      <td align="center" style="padding: 0 20px;">
                        <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9ca3af;">
                          ¿Necesitas ayuda? Contacta a nuestro equipo de soporte
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error enviando email con Resend:', error);
      return false;
    }

    const result = await response.json();
    console.log(`✅ Email enviado a ${email} (ID: ${result.id})`);
    return true;
    
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
}

serve(async (req) => {
  // Manejar preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, email, token, newPassword } = body;
    
    // Crear cliente Supabase con service_role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ==========================================
    // ACCIÓN 1: Solicitar reset de contraseña
    // ==========================================
    if (action === 'request') {
      
      if (!email || !email.trim()) {
        return new Response(
          JSON.stringify({ success: false, message: 'Email requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar usuario por email
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      
      const user = authUser?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      // IMPORTANTE: Por seguridad, NO revelar si el email existe o no
      // Siempre responder con el mismo mensaje genérico
      const genericMessage = 'Si el correo existe, recibirás un email con las instrucciones para restablecer tu contraseña.';
      
      if (!user) {
        console.log(`Solicitud de reset para email no existente: ${email}`);
        // Retornar éxito aunque el email no exista (seguridad)
        return new Response(
          JSON.stringify({ success: true, message: genericMessage }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generar token único
      const token = generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Expira en 1 hora

      // Guardar token en BD
      const { error: insertError } = await supabaseAdmin
        .from('password_reset_tokens')
        .insert({
          user_id: user.id,
          token: token,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error('Error guardando token:', insertError);
        // Aún así, retornar mensaje genérico
        return new Response(
          JSON.stringify({ success: true, message: genericMessage }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Enviar email con el link de reset
      const emailSent = await sendPasswordResetEmail(supabaseAdmin, email, token);
      
      console.log(`Token de reset generado para ${email}: ${emailSent ? 'Email enviado' : 'Email falló (ver logs)'}`);

      return new Response(
        JSON.stringify({ success: true, message: genericMessage }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // ACTION 2: Validar token de reset
    // ==========================================
    if (action === 'validate') {
      if (!token) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Token requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar token en BD
      const { data: resetToken, error: tokenError } = await supabaseAdmin
        .from('password_reset_tokens')
        .select('*')
        .eq('token', token)
        .is('used_at', null) // Solo tokens no usados
        .single();

      if (tokenError || !resetToken) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Enlace de recuperación inválido o caducado.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar si ha expirado
      const now = new Date();
      const expiresAt = new Date(resetToken.expires_at);
      
      if (now > expiresAt) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Enlace de recuperación inválido o caducado.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ valid: true, userId: resetToken.user_id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // ACTION 3: Resetear contraseña
    // ==========================================
    if (action === 'reset') {
      if (!token || !newPassword) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token y nueva contraseña requeridos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar longitud de contraseña
      if (newPassword.length < 6) {
        return new Response(
          JSON.stringify({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar y validar token (igual que en validate)
      const { data: resetToken, error: tokenError } = await supabaseAdmin
        .from('password_reset_tokens')
        .select('*')
        .eq('token', token)
        .is('used_at', null)
        .single();

      if (tokenError || !resetToken) {
        return new Response(
          JSON.stringify({ success: false, error: 'Enlace de recuperación inválido o caducado.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const now = new Date();
      const expiresAt = new Date(resetToken.expires_at);
      
      if (now > expiresAt) {
        return new Response(
          JSON.stringify({ success: false, error: 'Enlace de recuperación inválido o caducado.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ACTUALIZAR CONTRASEÑA usando Supabase Admin API
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        resetToken.user_id,
        { password: newPassword }
      );

      if (updateError) {
        console.error('Error actualizando contraseña:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al actualizar la contraseña' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Marcar token como usado
      await supabaseAdmin
        .from('password_reset_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);

      console.log(`Contraseña actualizada exitosamente para usuario ${resetToken.user_id}`);

      // OPCIONAL: Cerrar todas las sesiones activas del usuario por seguridad
      // await supabaseAdmin.auth.admin.signOut(resetToken.user_id, 'global');

      return new Response(
        JSON.stringify({ success: true, message: 'Contraseña actualizada correctamente.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Acción no reconocida
    return new Response(
      JSON.stringify({ error: 'Acción no válida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en password-reset:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
