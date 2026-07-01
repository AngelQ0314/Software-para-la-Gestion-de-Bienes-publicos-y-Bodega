# Módulo de Administración de Usuarios

Este documento describe las especificaciones técnicas de los endpoints del **Módulo de Administración de Usuarios** para el Sistema de Gestión de Bienes Públicos y Bodega.

> **Nota de Seguridad:** Todos estos endpoints están restringidos. Requieren que la petición incluya un token JWT válido con rol de **`ADMINISTRADOR`** o **`RESPONSABLE_DE_BIENES`** en la cabecera `Authorization: Bearer <TOKEN>`.
>
> ⚠️ **Restricción Importante:** El rol de **`RESPONSABLE_DE_BIENES`** es único. El sistema no permitirá crear ni asignar este rol a un usuario si ya existe otro con este mismo rol. Para cambiarlo, se le debe retirar el rol al usuario actual primero.

---

## Especificación de Endpoints

Todos los endpoints usan el prefijo base: `http://localhost:3000/api`

### 1. Registrar un Nuevo Usuario
Permite al administrador agregar una nueva cuenta al sistema. La contraseña temporal por defecto será la misma cédula ingresada. Envía un correo con las credenciales al docente de manera automática.

* **Áreas académicas válidas:** `DESARROLLO DE SOFTWARE`, `DISEÑO DE MODAS`, `GUIA NACIONAL DE TURISMO`, `ARTE CULINARIO ECUATORIANO`, `MARKETING DIGITAL`, `INGLES`.
* **Jornadas académicas válidas:** `MATUTINA`, `VESPERTINA`, `NOCTURNA` (obligatorias para áreas diferentes de `INGLES`).
* **Horario de Inglés:** Obligatorio únicamente si las áreas asignadas incluyen `INGLES`.

* **Método:** `POST`
* **Ruta:** `/users`
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "cedula": "1723456789",
    "correoInstitucional": "docente.yavirac@yavirac.edu.ec",
    "nombres": "JUAN CARLOS",
    "apellidos": "PEREZ",
    "rol": "DOCENTE",
    "areas": ["DESARROLLO DE SOFTWARE", "INGLES"],
    "jornadas": ["MATUTINA"],
    "horarioIngles": "De 8 a 10"
  }
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "message": "Usuario registrado correctamente. Se enviaron las credenciales al correo.",
    "user": {
      "id": "e4a2f8b1-3c9d-4c6e-8d9e-1f2a3b4c5d6e",
      "cedula": "1723456789",
      "correoInstitucional": "docente.yavirac@yavirac.edu.ec",
      "nombres": "JUAN CARLOS",
      "apellidos": "PEREZ",
      "rol": "DOCENTE",
      "estado": "PENDIENTE",
      "isFirstLogin": true,
      "profileCompleted": false,
      "areas": ["DESARROLLO DE SOFTWARE", "INGLES"],
      "jornadas": ["MATUTINA"],
      "horarioIngles": "De 8 a 10",
      "createdAt": "2026-06-30T20:30:15.000Z",
      "updatedAt": "2026-06-30T20:30:15.000Z"
    }
  }
  ```

---

### 2. Listar y Filtrar Usuarios
Permite buscar y listar de manera paginada los usuarios registrados en el sistema aplicando filtros de búsqueda.
* **Método:** `GET`
* **Ruta:** `/users`
* **Parámetros de Búsqueda (Query Params - Opcionales):**
  * `page`: Página actual (por defecto `1`).
  * `limit`: Cantidad de resultados (por defecto `10`).
  * `cedula`: Búsqueda parcial de la cédula.
  * `correo`: Búsqueda parcial de correo institucional.
  * `nombre`: Búsqueda parcial por nombres o apellidos del usuario.
  * `rol`: Filtro exacto (`ADMINISTRADOR` o `DOCENTE`).
  * `estado`: Filtro exacto (`PENDIENTE`, `ACTIVO`, `INACTIVO`, `DADO_DE_BAJA`).
* **Ejemplo de Petición:** `/users?page=1&limit=5&rol=DOCENTE&estado=ACTIVO`
* **Respuesta (200 OK):**
  ```json
  {
    "data": [
      {
        "id": "e4a2f8b1-3c9d-4c6e-8d9e-1f2a3b4c5d6e",
        "cedula": "1723456789",
        "correoInstitucional": "docente.yavirac@yavirac.edu.ec",
        "nombres": "Juan Carlos",
        "apellidos": "Pérez",
        "rol": "DOCENTE",
        "estado": "ACTIVO",
        "createdAt": "2026-06-30T20:30:15.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "lastPage": 1
  }
  ```

---

### 3. Consultar Detalle de un Usuario
Obtiene toda la información almacenada en el perfil de un usuario por medio de su identificador UUID.
* **Método:** `GET`
* **Ruta:** `/users/:id` (ej. `/users/e4a2f8b1-3c9d-4c6e-8d9e-1f2a3b4c5d6e`)
* **Respuesta (200 OK):**
  ```json
  {
    "id": "e4a2f8b1-3c9d-4c6e-8d9e-1f2a3b4c5d6e",
    "cedula": "1723456789",
    "correoInstitucional": "docente.yavirac@yavirac.edu.ec",
    "correoSecundario": "juan.personal@gmail.com",
    "nombres": "Juan Carlos",
    "apellidos": "Pérez",
    "telefono": "0998765432",
    "rol": "DOCENTE",
    "estado": "ACTIVO",
    "isFirstLogin": false,
    "profileCompleted": true,
    "areas": ["DESARROLLO DE SOFTWARE", "INGLES"],
    "jornadas": ["MATUTINA"],
    "horarioIngles": "De 8 a 10",
    "createdAt": "2026-06-30T20:30:15.000Z",
    "updatedAt": "2026-06-30T20:45:20.000Z"
  }
  ```

  ```

---

### 4. Editar Datos del Usuario
Permite al administrador o responsable de bienes modificar los datos personales, de contacto y de docencia de cualquier usuario del sistema.
* **Restricción de Docencia:** Los campos de clase (`areas`, `jornadas`, `horarioIngles`) solo son permitidos y validados si el usuario cuenta con el rol de `DOCENTE`. Si se intentan enviar para un `ADMINISTRADOR` o `RESPONSABLE_DE_BIENES`, el backend los rechazará con error `400 Bad Request`.
* **Método:** `PATCH`
* **Ruta:** `/users/:id` (ej. `/users/e4a2f8b1-3c9d-4c6e-8d9e-1f2a3b4c5d6e`)
* **Cuerpo de la Petición (todos los campos son opcionales):**
  ```json
  {
    "nombres": "NUEVOS NOMBRES",
    "apellidos": "NUEVOS APELLIDOS",
    "correoSecundario": "nuevo.personal@gmail.com",
    "telefono": "0991112223",
    "areas": ["INGLES"],
    "jornadas": [],
    "horarioIngles": "De 10 a 12"
  }
  ```
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Usuario actualizado correctamente",
    "user": {
      "id": "e4a2f8b1-3c9d-4c6e-8d9e-1f2a3b4c5d6e",
      "cedula": "1723456789",
      "correoInstitucional": "docente.yavirac@yavirac.edu.ec",
      "nombres": "NUEVOS NOMBRES",
      "apellidos": "NUEVOS APELLIDOS",
      "areas": ["INGLES"],
      "horarioIngles": "De 10 a 12",
      "updatedAt": "2026-07-01T..."
    }
  }
  ```

---

### 5. Cambiar Rol de un Usuario
Actualiza el nivel de acceso (rol) asignado a un usuario en el sistema.
* **Método:** `PATCH`
* **Ruta:** `/users/:id/rol`
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "rol": "ADMINISTRADOR"
  }
  ```
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Rol actualizado a ADMINISTRADOR"
  }
  ```

---

### 6. Cambiar Estado de un Usuario
Permite cambiar el estado de la cuenta de un usuario (`ACTIVO`, `INACTIVO`, `DADO_DE_BAJA`). Es obligatorio registrar una justificación/observación si se deshabilita la cuenta.
* **Método:** `PATCH`
* **Ruta:** `/users/:id/estado`
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "estado": "INACTIVO", // "ACTIVO" o "DADO_DE_BAJA"
    "observacion": "Docente desvinculado de la institución temporalmente" // Obligatorio para INACTIVO o DADO_DE_BAJA
  }
  ```
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Estado actualizado a INACTIVO"
  }
  ```

---

### 7. Reset Administrativo de Contraseña
Permite al administrador enviar un enlace de cambio de contraseña a un usuario cuando este ha perdido el acceso por completo.
* **Método:** `POST`
* **Ruta:** `/users/:id/reset-password`
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Enlace de restablecimiento enviado al correo del usuario"
  }
  ```

---

### 8. Consultar Historial de Cambios (Auditoría)
Muestra una bitácora de todas las modificaciones críticas de roles, estados y reinicios realizados sobre el usuario, indicando el administrador responsable.
* **Método:** `GET`
* **Ruta:** `/users/:id/logs`
* **Respuesta (200 OK):**
  ```json
  [
    {
      "id": "f8a1e2d4-3c9d-4c6e-8d9e-1f2a3b4c5d6e",
      "tipoCambio": "CAMBIO_ESTADO",
      "valorAnterior": "ACTIVO",
      "valorNuevo": "INACTIVO",
      "observacion": "Docente desvinculado de la institución temporalmente",
      "createdAt": "2026-06-30T21:10:00.000Z",
      "admin": {
        "id": "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
        "cedula": "1753675139",
        "nombres": "Administrador",
        "apellidos": "Principal"
      }
    }
  ]
  ```
