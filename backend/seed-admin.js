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
    console.log('⚠️  El administrador ya existe. No se creó uno nuevo.');
    await client.end();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN.cedula, 10); // contraseña temporal = cédula
  const id = crypto.randomUUID();

  await client.query(
    `INSERT INTO users (
      id, cedula, correo_institucional, nombres, apellidos,
      password, rol, estado, is_first_login, profile_completed
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVO', false, true)`,
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

  console.log('\n🎉 Administrador creado exitosamente:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Cédula:   ${ADMIN.cedula}`);
  console.log(`  Correo:   ${ADMIN.correoInstitucional}`);
  console.log(`  Password: ${ADMIN.cedula}  (temporal = cédula)`);
  console.log(`  Rol:      ${ADMIN.rol}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await client.end();
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
