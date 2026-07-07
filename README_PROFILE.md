# Módulo de Perfil del Docente

Este documento detalla las especificaciones de los endpoints del backend para la consulta y actualización de la información de perfil propia del docente y de los usuarios autenticados.

---

## Especificación de Endpoints

Todos los endpoints usan el prefijo base: `http://localhost:3000/api`

### 1. Consultar Perfil Propio
Obtiene la información completa del perfil del usuario autenticado actual.
*   **Método:** `GET`
*   **Ruta:** `/users/profile`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`, `DOCENTE`)
*   **Respuesta (200 OK):**
    ```json
    {
      "id": "e0447036-f8c9-40f5-b8ec-1eb9fdd3ee6c",
      "cedula": "1753675139",
      "correoInstitucional": "alc.quishpe@yavirac.edu.ec",
      "correoSecundario": "secundario.123@gmail.com",
      "nombres": "ANGEL LEONEL",
      "apellidos": "QUISHPE CURIPALLO",
      "telefono": "0987654321",
      "rol": "DOCENTE",
      "estado": "ACTIVO",
      "areas": ["DESARROLLO DE SOFTWARE"],
      "jornadas": ["MATUTINA"]
    }
    ```

---

### 2. Actualizar Perfil Propio
Permite al docente/usuario autenticado actualizar su correo electrónico secundario y su número de contacto.
*   **Método:** `PATCH`
*   **Ruta:** `/users/profile`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`, `DOCENTE`)
*   **Cuerpo de la Petición (JSON):**
    ```json
    {
      "correoSecundario": "nuevo.correo@gmail.com",
      "telefono": "0999888777"
    }
    ```
*   **Respuesta (200 OK):**
    ```json
    {
      "message": "Información personal actualizada correctamente.",
      "user": {
        "id": "e0447036-f8c9-40f5-b8ec-1eb9fdd3ee6c",
        "nombres": "ANGEL LEONEL",
        "apellidos": "QUISHPE CURIPALLO",
        "cedula": "1753675139",
        "correoInstitucional": "alc.quishpe@yavirac.edu.ec",
        "correoSecundario": "nuevo.correo@gmail.com",
        "telefono": "0999888777",
        "rol": "DOCENTE",
        "estado": "ACTIVO",
        "areas": ["DESARROLLO DE SOFTWARE"],
        "jornadas": ["MATUTINA"]
      }
    }
    ```
