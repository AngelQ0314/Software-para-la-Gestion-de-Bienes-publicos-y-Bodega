# Módulo de Autenticación y Gestión de Usuarios

Este documento describe las especificaciones, flujos de datos y especificaciones técnicas de los endpoints del **Módulo de Autenticación** para el Sistema de Gestión de Bienes Públicos y Bodega.

## Especificación de Endpoints

Todos los endpoints usan el prefijo base: `http://localhost:3000/api`

### 1. Iniciar Sesión (Login)
Permite verificar las credenciales del usuario (cédula o correo institucional) y retorna un token JWT.
* **Método:** `POST`
* **Ruta:** `/auth/login`
* **Acceso:** Público
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "identifier": "1753675139",
    "password": "mi_contraseña_temporal_o_segura"
  }
  ```
* **Respuesta (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "nextStep": "MUST_CHANGE_PASSWORD", // O null si ya completó su primer inicio
    "user": {
      "id": "c1f7b0e1-7e8c-4c6e-8d9e-1f2a3b4c5d6e",
      "cedula": "1753675139",
      "nombres": null,
      "apellidos": null,
      "rol": "DOCENTE", // O "ADMINISTRADOR" / "RESPONSABLE_DE_BIENES"
      "estado": "PENDIENTE",
      "isFirstLogin": true,
      "profileCompleted": false
    }
  }
  ```

---

### 2. Cambio Obligatorio de Contraseña Inicial
Obliga al usuario a cambiar la contraseña autogenerada en su primer acceso.
* **Método:** `POST`
* **Ruta:** `/auth/change-initial-password`
* **Acceso:** Privado (Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "currentPassword": "cédula_temporal",
    "newPassword": "NuevaContraseñaSegura1*",
    "confirmPassword": "NuevaContraseñaSegura1*"
  }
  ```
* **Reglas de Validación:**
  * La nueva contraseña debe tener mínimo 8 caracteres.
  * Debe contener al menos una letra mayúscula, una minúscula y un número.
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Contraseña actualizada. Por favor completa tu información personal.",
    "nextStep": "MUST_COMPLETE_PROFILE"
  }
  ```

---

### 3. Completar Información Personal
El usuario ingresa sus datos reales para activar su cuenta por completo.
* **Método:** `POST`
* **Ruta:** `/auth/complete-profile`
* **Acceso:** Privado (Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "nombres": "Leonel Angel",
    "apellidos": "Quishpe C.",
    "correoSecundario": "leonel.personal@gmail.com",
    "telefono": "0998765432"
  }
  ```
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Perfil completado. Bienvenido al sistema.",
    "redirectTo": "DOCENTE" // Redirección automática según el rol asignado
  }
  ```

---

### 4. Obtener Información del Usuario Logueado (me)
Permite al cliente obtener los detalles del token actual sin descodificarlo manualmente.
* **Método:** `GET`
* **Ruta:** `/auth/me`
* **Acceso:** Privado (Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Respuesta (200 OK):**
  ```json
  {
    "id": "c1f7b0e1-7e8c-4c6e-8d9e-1f2a3b4c5d6e",
    "cedula": "1753675139",
    "rol": "DOCENTE", // O "ADMINISTRADOR" / "RESPONSABLE_DE_BIENES"
    "estado": "ACTIVO",
    "isFirstLogin": false,
    "profileCompleted": true
  }
  ```

---

### 5. Solicitar Recuperación de Contraseña (Olvidó Contraseña)
Envía un enlace con un token seguro de 5 minutos de vigencia al correo electrónico.
* **Método:** `POST`
* **Ruta:** `/auth/forgot-password`
* **Acceso:** Público
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "correo": "docente@yavirac.edu.ec"
  }
  ```
* **Respuesta (200 OK):**
  * *En desarrollo (`development`), el token se retorna directamente en la respuesta:*
  ```json
  {
    "message": "Si el correo está registrado, recibirás un enlace en breve.",
    "dev_token": "a4d8c6b29f..." // Únicamente retornado en desarrollo
  }
  ```

---

### 6. Restablecer Contraseña (Nueva Contraseña)
Valida el token de recuperación y establece la nueva contraseña. **Este token es de un único uso.**
* **Método:** `POST`
* **Ruta:** `/auth/reset-password`
* **Acceso:** Público
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "token": "token_temporal_enviado_al_correo",
    "newPassword": "NuevaContraseñaSegura1*",
    "confirmPassword": "NuevaContraseñaSegura1*"
  }
  ```
* **Respuesta Exitosa (200 OK):**
  ```json
  {
    "message": "Contraseña actualizada correctamente. Ya puedes iniciar sesión."
  }
  ```
* **Respuesta Fallida si el token ya se usó (400 Bad Request):**
  ```json
  {
    "statusCode": 400,
    "message": "El enlace de recuperación no es válido o ya fue utilizado.",
    "error": "Bad Request"
  }
  ```

---

### 7. Cerrar Sesión (Logout)
Informa al backend del cierre de sesión seguro.
* **Método:** `POST`
* **Ruta:** `/auth/logout`
* **Acceso:** Privado (Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Sesión cerrada correctamente"
  }
  ```

---

### 8. Cambiar Contraseña Voluntariamente (Sesión Activa)
Permite a cualquier usuario cambiar su contraseña actual por una nueva mientras tenga una sesión activa en el sistema.
* **Método:** `POST`
* **Ruta:** `/auth/update-password`
* **Acceso:** Privado (Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "currentPassword": "mi_contraseña_actual",
    "newPassword": "NuevaContraseñaSegura1*",
    "confirmPassword": "NuevaContraseñaSegura1*"
  }
  ```
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Contraseña actualizada correctamente"
  }
  ```

---

### 9. Validar Token de Recuperación
Comprueba de forma pública si el token de recuperación recibido en la URL sigue siendo válido y la cuenta está activa (antes de pintar el formulario en el frontend).
* **Método:** `GET`
* **Ruta:** `/auth/validate-token/:token` (ej. `/auth/validate-token/a4d8c6b29f...`)
* **Acceso:** Público
* **Respuesta Exitosa - Token Válido (200 OK):**
  ```json
  {
    "valid": true
  }
  ```
* **Respuesta de Token Inválido o Expirado (200 OK):**
  ```json
  {
    "valid": false,
    "message": "El enlace de recuperación no es válido o ya fue utilizado." // O la justificación exacta
  }
  ```
