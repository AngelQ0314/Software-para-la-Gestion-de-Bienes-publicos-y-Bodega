# Módulo de Espacios Físicos Asignados

Este documento detalla las especificaciones de los endpoints del backend para la consulta de espacios físicos asignados a los docentes y la visualización de su inventario asociado de manera general o por jornada académica.

---

## Especificación de Endpoints

Todos los endpoints usan el prefijo base: `http://localhost:3000/api`

### 1. Consultar Espacios Asignados
Permite al docente visualizar el listado de los espacios físicos que le han sido asignados bajo su responsabilidad.
*   **Método:** `GET`
*   **Ruta:** `/spaces`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`, `DOCENTE`)
*   **Comportamiento:** Si el usuario tiene el rol de `DOCENTE`, la consulta se restringe estrictamente a los espacios físicos donde este docente esté vinculado como responsable. Para administradores y responsables de bienes, retorna la lista global.
*   **Respuesta (200 OK):**
    ```json
    [
      {
        "id": "e963048e-9704-48f4-be0a-d6c57756adb2",
        "roomNumber": "LAB-1",
        "name": "LABORATORIO DE DESARROLLO DE SOFTWARE 1",
        "type": "LABORATORIO",
        "location": "Piso 1, Bloque A",
        "capacity": 30,
        "jornadas": ["MATUTINA", "NOCTURNA"]
      }
    ]
    ```

---

### 2. Obtener Detalle de un Espacio Asignado
Permite obtener la información de detalle de un espacio físico específico.
*   **Método:** `GET`
*   **Ruta:** `/spaces/:id`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`, `DOCENTE`)
*   **Restricción de Seguridad:** Si el solicitante es un `DOCENTE`, debe estar asignado como responsable de este espacio. De lo contrario, la petición será rechazada con un error `403 Forbidden` ("No tienes asignada la responsabilidad de este espacio físico.").
*   **Respuesta (200 OK):**
    ```json
    {
      "id": "e963048e-9704-48f4-be0a-d6c57756adb2",
      "roomNumber": "LAB-1",
      "name": "LABORATORIO DE DESARROLLO DE SOFTWARE 1",
      "type": "LABORATORIO",
      "location": "Piso 1, Bloque A",
      "capacity": 30,
      "jornadas": ["MATUTINA", "NOCTURNA"],
      "responsibleTeachers": [
        {
          "id": "e0447036-f8c9-40f5-b8ec-1eb9fdd3ee6c",
          "nombres": "ANGEL LEONEL",
          "apellidos": "QUISHPE CURIPALLO",
          "correoInstitucional": "alc.quishpe@yavirac.edu.ec"
        }
      ]
    }
    ```

---

### 3. Consultar Inventario del Espacio (General o por Jornada)
Obtiene el listado detallado de bienes públicos, insumos y suministros, y material bibliográfico asignados al espacio físico.
*   **Método:** `GET`
*   **Ruta:** `/spaces/:id/inventory`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`, `DOCENTE`)
*   **Restricción de Seguridad:** Si el solicitante es un `DOCENTE`, debe estar asignado como responsable de este espacio. De lo contrario, la petición será rechazada con un error `403 Forbidden`.
*   **Parámetros Query (Opcionales):**
    *   `jornada`: La jornada académica a consultar (`MATUTINA`, `VESPERTINA`, `NOCTURNA`).
*   **Comportamiento del Filtro:**
    *   **Sin `jornada` (Inventario General):** Devuelve la lista completa de artículos asociados al aula física con información de su categoría, subcategoría y vista de inventario.
    *   **Con `jornada` (Inventario por Jornada):** Valida que la jornada consultada esté configurada para el espacio físico. Carga para cada ítem su estado físico (`estadoFisico`), observación y novedades registrados para dicha jornada en la bitácora física de control.
*   **Respuesta sin filtro de jornada (200 OK):**
    ```json
    [
      {
        "id": "b7abf012-fc09-4d7c-abf1-c3e2896963ba",
        "name": "COMPUTADORA DE ESCRITORIO",
        "codeValue": "INS-13811",
        "codeType": "CODIGO PA COMPUTADORAS",
        "category": "PERIFERICOS",
        "subcategory": "COMPUTADORAS",
        "view": "Bienes Públicos",
        "cantidad": 15
      }
    ]
    ```
*   **Respuesta con filtro de jornada (200 OK):**
    ```json
    [
      {
        "id": "b7abf012-fc09-4d7c-abf1-c3e2896963ba",
        "name": "COMPUTADORA DE ESCRITORIO",
        "codeValue": "INS-13811",
        "codeType": "CODIGO PA COMPUTADORAS",
        "category": "PERIFERICOS",
        "subcategory": "COMPUTADORAS",
        "view": "Bienes Públicos",
        "cantidad": 15,
        "jornada": "MATUTINA",
        "estadoFisico": "REGULAR",
        "observacion": "Tiene rayones en la carcasa",
        "novedades": "Ninguna"
      }
    ]
    ```
