// Script para probar generación de códigos TOTP
import * as OTPAuth from 'otpauth';

// El secreto debe coincidir con el que se generó en el servidor
const SECRET = process.argv[2] || 'JBSWY3DPEHPK3PXP'; // Secreto de ejemplo

console.log('🔑 Probando TOTP con secreto:', SECRET);

const totp = new OTPAuth.TOTP({
  issuer: 'EcoCERO',
  label: 'test@example.com',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  secret: SECRET,
});

// Generar código actual
const currentCode = totp.generate();
console.log('📱 Código actual:', currentCode);

// Generar URI para QR
const uri = totp.toString();
console.log('🔗 URI:', uri);

// Validar un código de prueba
if (process.argv[3]) {
  const testCode = process.argv[3];
  console.log('\n🧪 Validando código:', testCode);
  
  // Validar con ventana de 2
  const delta = totp.validate({ token: testCode, window: 2 });
  console.log('✅ Delta:', delta);
  console.log('✅ Válido:', delta !== null);
}
