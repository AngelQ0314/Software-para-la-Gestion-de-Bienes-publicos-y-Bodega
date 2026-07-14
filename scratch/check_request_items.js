const { Client } = require('pg');

async function check() {
  // Leer connection strings desde las variables de entorno o usar defaults
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/inventario',
  });

  try {
    await client.connect();
    console.log('--- CONEXIÓN EXITOSA A LA DB ---');

    console.log('\n--- ÚLTIMAS 5 SOLICITUDES DE LA TABLA requests ---');
    const requestsRes = await client.query('SELECT id, type, status, motive, space_id, destination_space_id FROM requests ORDER BY created_at DESC LIMIT 5');
    console.log(requestsRes.rows);

    console.log('\n--- DETALLES DE request_items PARA LA ÚLTIMA SOLICITUD ---');
    if (requestsRes.rows.length > 0) {
      const lastId = requestsRes.rows[0].id;
      const itemsRes = await client.query('SELECT * FROM request_items WHERE request_id = $1', [lastId]);
      console.log(itemsRes.rows);

      if (itemsRes.rows.length > 0) {
        console.log('\n--- ARTÍCULOS ASOCIADOS EN inventory_items ---');
        for (const row of itemsRes.rows) {
          const invRes = await client.query('SELECT id, name, "codigoYavirac", "codeValue" FROM inventory_items WHERE id = $1', [row.item_id]);
          console.log(`Para item_id ${row.item_id}:`, invRes.rows);
        }
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

check();
