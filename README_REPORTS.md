# Módulo de Gestión de Reportes

Este documento detalla las especificaciones de los endpoints del backend para la gestión de reportes consolidados del inventario, auditorías de usuarios, bitácoras de jornadas académicas y descarga de reportes oficiales en formato PDF.

---

## Especificación de Endpoints

Todos los endpoints usan el prefijo base: `http://localhost:3000/api`

### 1. Listar Historial de Reportes con Filtros
Permite obtener una lista de reportes en el historial aplicando filtros de búsqueda.
*   **Método:** `GET`
*   **Ruta:** `/reports`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Parámetros de Consulta (Opcionales):**
    *   `type` (enum) - Tipo de reporte: `PERIODO_ACADEMICO`, `JORNADA`, `GESTION_USUARIOS`, `NOVEDADES`.
    *   `academicPeriodId` (UUID) - Filtrar por período académico relacionado.
    *   `jornada` (string) - Filtrar por jornada: `MATUTINA`, `VESPERTINA`, `NOCTURNA`.
    *   `startDate` (ISO Date) - Fecha inicial de generación.
    *   `endDate` (ISO Date) - Fecha final de generación.
    *   `userId` (UUID) - Filtrar por usuario responsable o usuario afectado.
*   **Respuesta (200 OK):** Retorna un listado de reportes ordenados cronológicamente por su fecha de generación (`generatedAt DESC`).

---

### 2. Obtener Reporte de Cierre de Período Académico
Obtiene la instantánea consolidada de un período académico cerrado por medio de su identificador UUID.
*   **Método:** `GET`
*   **Ruta:** `/reports/period/:periodId`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Respuesta (200 OK):**
    ```json
    {
      "id": "e98fb1b2-132d-450f-a0bb-d8a7c2936239",
      "academicPeriodId": "f900a892-0b1a-4ab9-bdff-c88f11559811",
      "code": "REP-PERIODO-2026-I",
      "reportData": {
        "periodInfo": {
          "id": "f900a892-0b1a-4ab9-bdff-c88f11559811",
          "name": "2026-I",
          "startDate": "2026-03-01T05:00:00.000Z",
          "endDate": "2026-07-31T05:00:00.000Z",
          "closedAt": "2026-07-07T16:21:04.000Z",
          "typeOfClosure": "MANUAL"
        },
        "bodega": [],
        "spaces": [],
        "shifts": []
      },
      "generatedAt": "2026-07-07T16:21:04.000Z"
    }
    ```

---

### 3. Consultar Novedades o Incidencias Activas
Retorna las incidencias activas del inventario (artículos dañados o novedades) registradas por los docentes.
*   **Método:** `GET`
*   **Ruta:** `/reports/novedades/activas`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Respuesta (200 OK):** Retorna una lista con el detalle en tiempo real de artículos con daños reportados, mostrando la ubicación, el docente a cargo, el estado físico y las notas.

---

### 4. Generar y Registrar Reporte Histórico de Novedades
Compila las incidencias activas en un reporte de novedades histórico inmutable.
*   **Método:** `POST`
*   **Ruta:** `/reports/novedades/generar`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Cuerpo de la Petición (Opcional - JSON):**
    ```json
    {
      "academicPeriodId": "f900a892-0b1a-4ab9-bdff-c88f11559811"
    }
    ```
*   **Respuesta (201 Created):**
    ```json
    {
      "message": "Reporte histórico de novedades generado exitosamente.",
      "report": {
        "id": "1c7f98be-1122-3344-5566-778899aabbcc",
        "code": "REP-NOV-441264111",
        "type": "NOVEDADES",
        "academicPeriodId": "f900a892-0b1a-4ab9-bdff-c88f11559811",
        "reportData": {
          "generatedAt": "2026-07-07T16:21:04.111Z",
          "periodInfo": { "id": "f900a892-0b1a-4ab9-bdff-c88f11559811", "name": "2026-I" },
          "novelties": []
        },
        "generatedById": "15967c1b-7178-461d-8677-edea70a8d796"
      }
    }
    ```

---

### 5. Obtener Detalles de un Reporte
Obtiene el JSON inmutable y detalles del reporte por medio de su UUID.
*   **Método:** `GET`
*   **Ruta:** `/reports/:id`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)

---

### 6. Descargar Reporte en PDF
Genera y descarga la versión imprimible formateada en PDF de un reporte específico.
*   **Método:** `GET`
*   **Ruta:** `/reports/:id/download`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Respuesta (200 OK):** Retorna un flujo binario (`stream`) de tipo `application/pdf` con la cabecera `Content-Disposition: attachment` para descarga directa en el navegador, nombrando el archivo según su código (ej. `Reporte_REP-NOV-441264111.pdf`).
