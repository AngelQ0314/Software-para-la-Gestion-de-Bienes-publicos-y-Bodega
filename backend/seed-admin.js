/**
 * Script para crear el primer usuario ADMINISTRADOR en la base de datos.
 * Ejecutar UNA SOLA VEZ: node seed-admin.js
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Datos del primer admin — CAMBIAR antes de ejecutar
const ADMIN = {
  cedula: '1753675139',
  correoInstitucional: 'alc.quishpe@yavirac.edu.ec',
  nombres: 'Administrador',
  apellidos: 'Principal',
  rol: 'ADMINISTRADOR',
};

// Carga el .env.development
require('fs')
  .readFileSync('.env.development', 'utf-8')
  .split('\n')
  .forEach((line) => {
    const [key, ...val] = line.split('=');
    if (key && !key.startsWith('#')) process.env[key.trim()] = val.join('=').trim();
  });

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  });

  await client.connect();
  console.log('Conectado a PostgreSQL');

  // Verificar si ya existe
  const existe = await client.query(
    'SELECT id FROM users WHERE cedula = $1 OR correo_institucional = $2',
    [ADMIN.cedula, ADMIN.correoInstitucional],
  );

  if (existe.rows.length > 0) {
    console.log('El administrador ya existe. No se creó uno nuevo.');
    await client.end();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN.cedula, 10); // contraseña temporal = cédula
  const id = crypto.randomUUID();

  // Se registra como ACTIVO, pero con is_first_login = true para obligar cambio de clave.
  // profile_completed = true evita que tenga que llenar formulario de datos (pues ya están sembrados).
  await client.query(
    `INSERT INTO users (
      id, cedula, correo_institucional, nombres, apellidos,
      password, rol, estado, is_first_login, profile_completed
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVO', true, true)`,
    [
      id,
      ADMIN.cedula,
      ADMIN.correoInstitucional,
      ADMIN.nombres,
      ADMIN.apellidos,
      passwordHash,
      ADMIN.rol,
    ],
  );

  console.log('\n Administrador insertado en la Base de Datos.');

  // Enviar correo de bienvenida al administrador
  console.log('Enviando correo de credenciales...');
  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT || '587'),
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: `"${process.env.MAIL_FROM_NAME || 'Sistema'}" <${process.env.MAIL_USER}>`,
    to: ADMIN.correoInstitucional,
    subject: 'Bienvenido al Sistema de Gestión - Credenciales de Acceso',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
        <h2 style="color: #1a73e8; text-align: center;">Bienvenido al Sistema Yavirac</h2>
        <p>Hola, <strong>${ADMIN.nombres} ${ADMIN.apellidos}</strong>.</p>
        <p>Has sido registrado en el sistema con el rol de <strong>${ADMIN.rol}</strong>.</p>
        <div style="background-color: #f1f3f4; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Enlace de Acceso:</strong> <a href="http://localhost:4200/login">http://localhost:4200/login</a></p>
          <p style="margin: 5px 0;"><strong>Usuario (Cédula o Correo):</strong> ${ADMIN.cedula}</p>
          <p style="margin: 5px 0;"><strong>Contraseña Temporal:</strong> ${ADMIN.cedula}</p>
        </div>
        <div style="background-color: #fdf2e2; border-left: 4px solid #f2994a; padding: 10px; margin: 20px 0; font-size: 13px;">
          <strong>Importante:</strong> Al ingresar por primera vez deberás cambiar tu contraseña temporal obligatoriamente antes de poder acceder al panel de control.
        </div>
        <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
          Este es un correo automático. Por favor, no respondas a este mensaje.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Correo enviado exitosamente al administrador.');
  } catch (error) {
    console.log('No se pudo enviar el correo de bienvenida:', error.message);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Cédula:   ${ADMIN.cedula}`);
  console.log(`  Correo:   ${ADMIN.correoInstitucional}`);
  console.log(`  Password: ${ADMIN.cedula}  (temporal = cédula)`);
  console.log(`  Rol:      ${ADMIN.rol}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await client.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
