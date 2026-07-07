# Módulo de Gestión de Períodos Académicos

Este documento detalla las especificaciones de los endpoints del backend para administrar el ciclo de vida de los períodos académicos del inventario.

---

## Especificación de Endpoints

Todos los endpoints usan el prefijo base: `http://localhost:3000/api`

### 1. Registrar Período Académico
Permite configurar un nuevo período académico en el sistema.
*   **Método:** `POST`
*   **Ruta:** `/periods`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "name": "PERÍODO 2026-I",
      "startDate": "2026-07-07T08:00:00.000Z",
      "endDate": "2026-12-20T18:00:00.000Z"
    }
    ```
*   **Respuesta (201 Created):**
    ```json
    {
      "id": "70f62164-a2d7-469a-825d-28c3f85ffffb",
      "name": "PERÍODO 2026-I",
      "startDate": "2026-07-07T08:00:00.000Z",
      "endDate": "2026-12-20T18:00:00.000Z",
      "status": "CONFIGURADO",
      "notified48h": false,
      "closedAt": null
    }
    ```

---

### 2. Listar Períodos Académicos
Obtiene una lista con todos los períodos académicos registrados.
*   **Método:** `GET`
*   **Ruta:** `/periods`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Respuesta (200 OK):**
    ```json
    [
      {
        "id": "70f62164-a2d7-469a-825d-28c3f85ffffb",
        "name": "PERÍODO 2026-I",
        "startDate": "2026-07-07T08:00:00.000Z",
        "endDate": "2026-12-20T18:00:00.000Z",
        "status": "CONFIGURADO",
        "notified48h": false,
        "closedAt": null
      }
    ]
    ```

---

### 3. Obtener Detalles de un Período Académico
Muestra la información de un período académico por su identificador UUID.
*   **Método:** `GET`
*   **Ruta:** `/periods/:id`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Respuesta (200 OK):**
    ```json
    {
      "id": "70f62164-a2d7-469a-825d-28c3f85ffffb",
      "name": "PERÍODO 2026-I",
      "startDate": "2026-07-07T08:00:00.000Z",
      "endDate": "2026-12-20T18:00:00.000Z",
      "status": "CONFIGURADO",
      "notified48h": false,
      "closedAt": null
    }
    ```

---

### 4. Activar Período Académico
Activa un período académico configurado. Solo se permite un período activo a la vez. Incorpora automáticamente los artículos en estado pendiente.
*   **Método:** `POST`
*   **Ruta:** `/periods/:id/activate`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Respuesta (200 OK):**
    ```json
    {
      "message": "Período académico 'PERÍODO 2026-I' activado con éxito. Los artículos pendientes han sido incorporados.",
      "period": {
        "id": "70f62164-a2d7-469a-825d-28c3f85ffffb",
        "name": "PERÍODO 2026-I",
        "startDate": "2026-07-07T08:00:00.000Z",
        "endDate": "2026-12-20T18:00:00.000Z",
        "status": "ACTIVO",
        "notified48h": false,
        "closedAt": null
      }
    }
    ```

---

### 5. Cerrar Período Académico (Manual)
Cierra el período académico activo actual. Bloquea el inventario y desencadena la compilación de reportes históricos de cierre y jornadas académicas en el módulo central de reportes.
*   **Método:** `POST`
*   **Ruta:** `/periods/:id/close`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`)
*   **Respuesta (200 OK):**
    ```json
    {
      "message": "Período académico 'PERÍODO 2026-I' cerrado con éxito. El reporte histórico ha sido generado.",
      "period": {
        "id": "70f62164-a2d7-469a-825d-28c3f85ffffb",
        "name": "PERÍODO 2026-I",
        "startDate": "2026-07-07T08:00:00.000Z",
        "endDate": "2026-12-20T18:00:00.000Z",
        "status": "CERRADO",
        "notified48h": false,
        "closedAt": "2026-07-07T14:51:54.000Z"
      }
    }
    ```
