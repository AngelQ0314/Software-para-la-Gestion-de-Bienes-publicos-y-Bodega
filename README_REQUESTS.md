# Módulo de Gestión de Solicitudes y Actas de Recepción

Este documento detalla las especificaciones de los endpoints del backend para la gestión de solicitudes de bienes, insumos y suministros o material bibliográfico por parte de los docentes, así como la generación de sus actas físicas de entrega-recepción y transferencias entre aulas.

---

## Especificación de Endpoints

Todos los endpoints usan el prefijo base: `http://localhost:3000/api`

### 1. Registrar una Solicitud
Permite a un docente registrar una solicitud de inventario. Puede ser de dos tipos: solicitar nuevo inventario desde bodega o transferir inventario existente entre espacios físicos bajo su responsabilidad.
*   **Método:** `POST`
*   **Ruta:** `/requests`
*   **Acceso:** Privado (Requiere rol `DOCENTE`)
*   **Restricción de Seguridad:** El docente autenticado debe estar asignado como responsable del espacio físico de origen/solicitud (`spaceId`).
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "spaceId": "8ce928d1-d249-4eb1-995a-6fc441c2c31e",
      "destinationSpaceId": "9ce928d1-d249-4eb1-995a-6fc441c2c31f", // Opcional. Requerido si type es TRANSFERENCIA.
      "type": "TRANSFERENCIA", // "NUEVO_INVENTARIO" o "TRANSFERENCIA"
      "motive": "Uso para prácticas de laboratorio de la asignatura de base de datos.",
      "items": [
        {
          "itemId": "b0ef460f-e275-4fc1-a9bc-f3fa54e21a22",
          "cantidad": 1
        }
      ]
    }
    ```
*   **Comportamiento:**
    *   Si `type` es `NUEVO_INVENTARIO`, se valida que los artículos solicitados existan en Bodega General (`physicalSpaceId` es nulo) y tengan stock suficiente.
    *   Si `type` es `TRANSFERENCIA`, se valida que los artículos estén asignados al espacio de origen (`spaceId`) y la cantidad solicitada no supere la cantidad disponible en dicho espacio.
*   **Respuesta (201 Created):**
    ```json
    {
      "id": "f44ebef1-db53-4ff3-83f5-7484d34f0e22",
      "teacherId": "e0447036-f8c9-40f5-b8ec-1eb9fdd3ee6c",
      "spaceId": "8ce928d1-d249-4eb1-995a-6fc441c2c31e",
      "destinationSpaceId": "9ce928d1-d249-4eb1-995a-6fc441c2c31f",
      "type": "TRANSFERENCIA",
      "status": "EN_PROCESO",
      "motive": "Uso para prácticas de laboratorio de la asignatura de base de datos.",
      "rejectionReason": null,
      "resolvedAt": null,
      "resolvedById": null,
      "createdAt": "2026-07-08T15:16:51.341Z",
      "updatedAt": "2026-07-08T15:16:51.341Z",
      "items": [
        {
          "id": "e9e62815-cc7b-435a-a529-6c2936e5902f",
          "requestId": "f44ebef1-db53-4ff3-83f5-7484d34f0e22",
          "itemId": "b0ef460f-e275-4fc1-a9bc-f3fa54e21a22",
          "cantidad": 1
        }
      ]
    }
    ```

---

### 2. Listar Solicitudes con Filtros
Permite listar las solicitudes en el sistema aplicando filtros opcionales.
*   **Método:** `GET`
*   **Ruta:** `/requests`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`, `DOCENTE`)
*   **Restricción de Seguridad:** Si el usuario autenticado tiene el rol de `DOCENTE`, el listado se filtra automáticamente de forma obligatoria para mostrar únicamente las solicitudes creadas por él. Los administradores y responsables de bienes visualizan todas las solicitudes.
*   **Parámetros de Consulta (Opcionales):**
    *   `teacherId` (UUID) - Filtrar por docente solicitante (ignorado si el solicitante es docente).
    *   `status` (string) - Filtrar por estado (`EN_PROCESO`, `APROBADA`, `RECHAZADA`).
    *   `academicPeriodId` (UUID) - Filtrar por período académico.
    *   `spaceId` (UUID) - Filtrar por aula/laboratorio de origen.
    *   `startDate` (ISO DateTime) - Fecha de inicio rango de creación.
    *   `endDate` (ISO DateTime) - Fecha de finalización rango de creación.
*   **Respuesta (200 OK):**
    ```json
    [
      {
        "id": "f44ebef1-db53-4ff3-83f5-7484d34f0e22",
        "status": "APROBADA",
        "type": "TRANSFERENCIA",
        "motive": "Uso para prácticas de laboratorio de la asignatura de base de datos.",
        "createdAt": "2026-07-08T15:16:51.341Z",
        "teacher": {
          "id": "e0447036-f8c9-40f5-b8ec-1eb9fdd3ee6c",
          "nombres": "ANGEL LEONEL",
          "apellidos": "QUISHPE CURIPALLO",
          "correoInstitucional": "aquishpe@yavirac.edu.ec"
        },
        "space": {
          "id": "8ce928d1-d249-4eb1-995a-6fc441c2c31e",
          "roomNumber": "LAB-ORIGIN",
          "name": "Laboratorio de Pruebas Origen"
        },
        "destinationSpace": {
          "id": "9ce928d1-d249-4eb1-995a-6fc441c2c31f",
          "roomNumber": "LAB-DEST",
          "name": "Laboratorio de Pruebas Destino"
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
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`, `DOCENTE`)
*   **Restricción de Seguridad:** Si el usuario autenticado tiene el rol de `DOCENTE`, solo puede acceder al detalle de solicitudes que él mismo haya registrado. En caso contrario, se deniega el acceso con un error `403 Forbidden`.
*   **Respuesta (200 OK):** Retorna la información completa de la solicitud incluyendo el docente, aula de origen, aula de destino (si aplica), período, responsable de resolución, lista de artículos con detalles de categorías y vistas de inventario, y el acta firmada generada.

---

### 4. Aprobar una Solicitud
Permite al administrador o responsable de bienes aprobar una solicitud registrada en estado `EN_PROCESO`.
*   **Método:** `POST`
*   **Ruta:** `/requests/:id/approve`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Comportamiento en Aprobación de TRANSFERENCIA:**
    1. El artículo se traslada físicamente al espacio destino (`physicalSpaceId = destinationSpaceId`).
    2. Se clona el ítem y se inicializan de forma automática sus registros correspondientes en la tabla de jornadas/turnos (`InventoryItemShift`) para el espacio físico de destino, asegurando la consistencia diaria del control del inventario.
    3. Se genera y archiva el acta de transferencia en formato PDF.
*   **Respuesta (200 OK):**
    ```json
    {
      "message": "Solicitud aprobada correctamente. El acta de entrega-recepción ha sido generada y el stock actualizado.",
      "request": {
        "id": "f44ebef1-db53-4ff3-83f5-7484d34f0e22",
        "status": "APROBADA",
        "resolvedAt": "2026-07-08T15:16:51.688Z",
        "resolvedById": "15967c1b-7178-461d-8677-edea70a8d796"
      }
    }
    ```

---

### 5. Rechazar una Solicitud
Permite al administrador o responsable de bienes rechazar una solicitud registrada en estado `EN_PROCESO` indicando el motivo de rechazo.
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
        "resolvedAt": "2026-07-08T15:16:51.341Z",
        "resolvedById": "15967c1b-7178-461d-8677-edea70a8d796"
      }
    }
    ```

---

### 6. Visualizar / Descargar Acta de Recepción (PDF)
Obtiene el acta en formato PDF de la solicitud aprobada.
*   **Método:** `GET`
*   **Ruta:** `/requests/:id/acta`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`, `DOCENTE`)
*   **Restricción de Seguridad:** Si el usuario autenticado tiene el rol de `DOCENTE`, solo puede visualizar/descargar el acta de solicitudes aprobadas creadas por él mismo. En caso contrario, se deniega el acceso con un error `403 Forbidden`.
*   **Respuesta (200 OK):** Retorna un flujo de archivo binario (`stream`) de tipo `application/pdf` con la cabecera `Content-Disposition: inline` que permite abrir el PDF directamente en el navegador o iniciar su descarga con el nombre original del acta (ej. `Acta_ACTA-2026-0001.pdf`).
