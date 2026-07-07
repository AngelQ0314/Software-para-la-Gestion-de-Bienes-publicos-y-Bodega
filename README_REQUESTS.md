# Módulo de Gestión de Solicitudes y Actas de Recepción

Este documento detalla las especificaciones de los endpoints del backend para la gestión de solicitudes de bienes, insumos y suministros o material bibliográfico por parte de los docentes, así como la generación de sus actas físicas de entrega-recepción.

---

## Especificación de Endpoints

Todos los endpoints usan el prefijo base: `http://localhost:3000/api`

### 1. Registrar una Solicitud
Permite a un docente registrar una solicitud de artículos para un espacio físico destino.
*   **Método:** `POST`
*   **Ruta:** `/requests`
*   **Acceso:** Privado (Requiere rol `DOCENTE`)
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "spaceId": "8ce928d1-d249-4eb1-995a-6fc441c2c31e",
      "motive": "Uso para prácticas de laboratorio de la asignatura de base de datos.",
      "items": [
        {
          "itemId": "b0ef460f-e275-4fc1-a9bc-f3fa54e21a22",
          "cantidad": 10
        },
        {
          "itemId": "fa41e7f3-e580-4592-93eb-bb097561f3cd",
          "cantidad": 1
        }
      ]
    }
    ```
*   **Respuesta (201 Created):**
    ```json
    {
      "id": "f44ebef1-db53-4ff3-83f5-7484d34f0e22",
      "teacherId": "e0447036-f8c9-40f5-b8ec-1eb9fdd3ee6c",
      "spaceId": "8ce928d1-d249-4eb1-995a-6fc441c2c31e",
      "academicPeriodId": "88faa063-c21d-4b59-9b2d-4d48569f63d3",
      "status": "EN_PROCESO",
      "motive": "Uso para prácticas de laboratorio de la asignatura de base de datos.",
      "rejectionReason": null,
      "resolvedAt": null,
      "resolvedById": null,
      "createdAt": "2026-07-07T15:16:51.341Z",
      "updatedAt": "2026-07-07T15:16:51.341Z",
      "items": [
        {
          "id": "e9e62815-cc7b-435a-a529-6c2936e5902f",
          "requestId": "f44ebef1-db53-4ff3-83f5-7484d34f0e22",
          "itemId": "b0ef460f-e275-4fc1-a9bc-f3fa54e21a22",
          "cantidad": 10
        }
      ]
    }
    ```

---

### 2. Listar Solicitudes con Filtros
Permite listar las solicitudes en el sistema aplicando filtros opcionales.
*   **Método:** `GET`
*   **Ruta:** `/requests`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Parámetros de Consulta (Opcionales):**
    *   `teacherId` (UUID) - Filtrar por docente solicitante.
    *   `status` (string) - Filtrar por estado (`EN_PROCESO`, `APROBADA`, `RECHAZADA`).
    *   `academicPeriodId` (UUID) - Filtrar por período académico.
    *   `spaceId` (UUID) - Filtrar por aula/laboratorio.
    *   `startDate` (ISO DateTime) - Fecha de inicio rango de creación.
    *   `endDate` (ISO DateTime) - Fecha de finalización rango de creación.
*   **Respuesta (200 OK):**
    ```json
    [
      {
        "id": "f44ebef1-db53-4ff3-83f5-7484d34f0e22",
        "status": "APROBADA",
        "motive": "Uso para prácticas de laboratorio de la asignatura de base de datos.",
        "createdAt": "2026-07-07T15:16:51.341Z",
        "teacher": {
          "id": "e0447036-f8c9-40f5-b8ec-1eb9fdd3ee6c",
          "nombres": "ANGEL LEONEL",
          "apellidos": "QUISHPE CURIPALLO",
          "correoInstitucional": "aquishpe@yavirac.edu.ec"
        },
        "space": {
          "id": "8ce928d1-d249-4eb1-995a-6fc441c2c31e",
          "roomNumber": "TEST-303",
          "name": "Laboratorio de Pruebas"
        },
        "academicPeriod": {
          "id": "88faa063-c21d-4b59-9b2d-4d48569f63d3",
          "name": "PERIODO SOLICITUDES"
        }
      }
    ]
    ```

---

### 3. Obtener Detalle de una Solicitud
Obtiene el detalle completo de una solicitud específica.
*   **Método:** `GET`
*   **Ruta:** `/requests/:id`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Respuesta (200 OK):** Detalla de forma completa la solicitud incluyendo docente, aula física, período, responsable de resolución, ítems solicitados con sus detalles de categoría y vista de inventario, y el acta vinculada si existe.

---

### 4. Aprobar una Solicitud
Permite al administrador o responsable de bienes aprobar una solicitud registrada.
*   **Método:** `POST`
*   **Ruta:** `/requests/:id/approve`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Respuesta (200 OK):**
    ```json
    {
      "message": "Solicitud aprobada correctamente. El acta de entrega-recepción ha sido generada y el stock actualizado.",
      "request": {
        "id": "f44ebef1-db53-4ff3-83f5-7484d34f0e22",
        "status": "APROBADA",
        "resolvedAt": "2026-07-07T15:16:51.688Z",
        "resolvedById": "15967c1b-7178-461d-8677-edea70a8d796"
      }
    }
    ```

---

### 5. Rechazar una Solicitud
Permite al administrador o responsable de bienes rechazar una solicitud registrada indicando un motivo.
*   **Método:** `POST`
*   **Ruta:** `/requests/:id/reject`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "rejectionReason": "No se justifica el uso de insumos adicionales en las jornadas extras."
    }
    ```
*   **Respuesta (200 OK):**
    ```json
    {
      "message": "Solicitud rechazada correctamente y motivo archivado.",
      "request": {
        "id": "52fde371-255d-4f10-ae40-e22ff1128dfa",
        "status": "RECHAZADA",
        "rejectionReason": "No se justifica el uso de insumos adicionales en las jornadas extras.",
        "resolvedAt": "2026-07-07T15:16:51.341Z",
        "resolvedById": "15967c1b-7178-461d-8677-edea70a8d796"
      }
    }
    ```

---

### 6. Visualizar / Descargar Acta de Recepción (PDF)
Obtiene el acta PDF de la solicitud aprobada.
*   **Método:** `GET`
*   **Ruta:** `/requests/:id/acta`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Respuesta (200 OK):** Retorna un flujo de archivo binario (`stream`) de tipo `application/pdf` con la cabecera `Content-Disposition: inline` que permite abrir el PDF directamente en el navegador o iniciar su descarga con el nombre original del acta (ej. `Acta_ACTA-2026-0001.pdf`).
