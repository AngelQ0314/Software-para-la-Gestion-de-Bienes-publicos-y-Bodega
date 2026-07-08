# Módulo de Reporte de Novedades e Incidencias (Docente / Administrador)

Este documento detalla las especificaciones de los endpoints del backend para el registro de novedades o incidencias relacionadas con los bienes públicos, insumos y suministros, y material bibliográfico asignados a los espacios físicos.

---

## Especificación de Endpoints

Todos los endpoints usan el prefijo base: `http://localhost:3000/api`

### 1. Registrar un Reporte de Novedad
Permite a un docente registrar una novedad o incidencia sobre uno o varios elementos del inventario asignados a un espacio físico bajo su responsabilidad.
*   **Método:** `POST`
*   **Ruta:** `/incidents`
*   **Acceso:** Privado (Requiere rol `DOCENTE`)
*   **Restricción de Seguridad:** El docente autenticado debe estar asignado como responsable del espacio físico (`spaceId`).
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "spaceId": "11111111-1111-1111-1111-111111111222",
      "jornada": "MATUTINA", // MATUTINA, VESPERTINA, NOCTURNA
      "description": "El proyector emite un zumbido fuerte y no muestra imagen.",
      "itemIds": [
        "22222222-0000-4000-a000-000000000002"
      ]
    }
    ```
*   **Comportamiento:**
    *   Asocia automáticamente el reporte al período académico activo.
    *   Valida que la jornada académica elegida esté configurada en el espacio físico.
    *   Valida que todos los `itemIds` existan, estén activos y pertenezcan físicamente al espacio de origen (`spaceId`).
    *   Genera un código único automático con formato `INC-YYYY-XXXX`.
*   **Respuesta (201 Created):**
    ```json
    {
      "message": "El reporte de novedad fue registrado y enviado correctamente al administrador.",
      "report": {
        "id": "e44ebef1-db53-4ff3-83f5-7484d34f0e99",
        "code": "INC-2026-0001",
        "teacherId": "e0447036-f8c9-40f5-b8ec-1eb9fdd3ee6c",
        "spaceId": "11111111-1111-1111-1111-111111111222",
        "academicPeriodId": "f800a892-0b1a-4ab9-bdff-c88f11559822",
        "jornada": "MATUTINA",
        "description": "El proyector emite un zumbido fuerte y no muestra imagen.",
        "status": "PENDIENTE",
        "createdAt": "2026-07-08T15:20:00.000Z",
        "updatedAt": "2026-07-08T15:20:00.000Z",
        "items": [
          {
            "id": "a9e62815-cc7b-435a-a529-6c2936e59000",
            "incidentReportId": "e44ebef1-db53-4ff3-83f5-7484d34f0e99",
            "itemId": "22222222-0000-4000-a000-000000000002"
          }
        ]
      }
    }
    ```

---

### 2. Listar Reportes de Novedad con Filtros
Permite listar las novedades e incidencias registradas en el sistema.
*   **Método:** `GET`
*   **Ruta:** `/incidents`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`, `DOCENTE`)
*   **Restricción de Seguridad:** Si el usuario es de rol `DOCENTE`, la consulta se filtra de forma forzada para mostrar exclusivamente las novedades que él mismo reportó. Los administradores y responsables de bienes visualizan el listado global.
*   **Parámetros de Consulta (Opcionales):**
    *   `teacherId` (UUID) - Filtrar por docente informante (ignorado si el solicitante es docente).
    *   `spaceId` (UUID) - Filtrar por espacio físico.
    *   `jornada` (string) - Filtrar por jornada (`MATUTINA`, `VESPERTINA`, `NOCTURNA`).
    *   `status` (string) - Filtrar por estado (`PENDIENTE`, `REVISADO`, `RESUELTO`).
    *   `academicPeriodId` (UUID) - Filtrar por período académico.
*   **Respuesta (200 OK):**
    ```json
    [
      {
        "id": "e44ebef1-db53-4ff3-83f5-7484d34f0e99",
        "code": "INC-2026-0001",
        "jornada": "MATUTINA",
        "description": "El proyector emite un zumbido fuerte y no muestra imagen.",
        "status": "PENDIENTE",
        "createdAt": "2026-07-08T15:20:00.000Z",
        "teacher": {
          "id": "e0447036-f8c9-40f5-b8ec-1eb9fdd3ee6c",
          "nombres": "ANGEL LEONEL",
          "apellidos": "QUISHPE CURIPALLO",
          "correoInstitucional": "aquishpe@yavirac.edu.ec"
        },
        "space": {
          "id": "11111111-1111-1111-1111-111111111222",
          "roomNumber": "LAB-ORIGIN",
          "name": "Laboratorio de Pruebas Origen"
        },
        "academicPeriod": {
          "id": "f800a892-0b1a-4ab9-bdff-c88f11559822",
          "name": "Período Pruebas Novedades"
        }
      }
    ]
    ```

---

### 3. Obtener Detalle de un Reporte de Novedad
Obtiene la información completa de un reporte de novedad específico y sus ítems involucrados.
*   **Método:** `GET`
*   **Ruta:** `/incidents/:id`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`, `DOCENTE`)
*   **Restricción de Seguridad:** Si el usuario es de rol `DOCENTE`, solo puede acceder al detalle de novedades creadas por él. De lo contrario, se deniega con un error `403 Forbidden`.
*   **Respuesta (200 OK):** Retorna la información completa de la novedad, el docente, el aula física, el período, y la lista de artículos del inventario afectados con su respectiva categoría, subcategoría y vista.

---

### 4. Actualizar Estado de la Novedad (Seguimiento Admin)
Permite al administrador o responsable de bienes actualizar el estado de una novedad para registrar el seguimiento y resolución de la misma.
*   **Método:** `PATCH`
*   **Ruta:** `/incidents/:id/status`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "status": "REVISADO" // PENDIENTE, REVISADO, RESUELTO
    }
    ```
*   **Respuesta (200 OK):**
    ```json
    {
      "message": "El estado del reporte de novedad ha sido actualizado a REVISADO correctamente.",
      "report": {
        "id": "e44ebef1-db53-4ff3-83f5-7484d34f0e99",
        "code": "INC-2026-0001",
        "status": "REVISADO",
        "updatedAt": "2026-07-08T15:30:00.000Z"
      }
    }
    ```
