# Módulo de Gestión de Espacios Físicos

Este documento describe las especificaciones, flujos de datos y especificaciones técnicas de los endpoints del **Módulo de Gestión de Espacios Físicos** para el Sistema de Gestión de Bienes Públicos y Bodega.

---


## Especificación de Endpoints

Todos los endpoints usan el prefijo base: `http://localhost:3000/api`

---

### 1. Obtener Todos los Espacios Físicos
Permite listar todos los laboratorios, aulas, bodegas u oficinas registrados en el sistema, aplicando filtros opcionales de búsqueda y cargando las relaciones asociadas.
* **Método:** `GET`
* **Ruta:** `/spaces`
* **Acceso:** Privado (Requiere token JWT con rol de `ADMINISTRADOR` o `RESPONSABLE_DE_BIENES`)
* **Parámetros de Búsqueda (Query Params - Opcionales):**
  * `roomNumber`: Filtro por código/número de espacio (ej. `LAB-4`).
  * `name`: Búsqueda parcial del nombre (ej. `Laboratorio`).
  * `type`: Tipo exacto (`AULA`, `LABORATORIO`, `TALLER`, `OFICINA`, `BODEGA`).
  * `location`: Búsqueda parcial de la ubicación (ej. `Piso 2`).
* **Respuesta (200 OK):**
  ```json
  [
    {
      "id": "c6783b73-22c5-4524-904a-2585e111ed70",
      "roomNumber": "LAB-4",
      "name": "LABORATORIO DE DESARROLLO DE SOFTWARE 3",
      "type": "LABORATORIO",
      "location": "Piso 2, Bloque B",
      "capacity": 30,
      "jornadas": ["MATUTINA", "NOCTURNA"],
      "createdAt": "2026-07-06T19:40:12.438Z",
      "updatedAt": "2026-07-06T19:40:12.438Z",
      "responsibleTeachers": [],
      "items": [
        {
          "id": "e9c8cf44-4352-4584-a093-ed7fcc931889",
          "name": "cuchillo metalico",
          "codeValue": "codigo003",
          "cantidad": 10,
          "status": "ACTIVO",
          "codeType": {
            "id": "fcbed5d7-51ae-4f4d-af5f-bb9208069164",
            "name": "COGIGO PARA CUCHILLOS",
            "prefix": "CPC"
          }
        }
      ]
    }
  ]
  ```

---

### 2. Obtener Detalle de un Espacio Físico
Retorna la información completa de un espacio físico, sus docentes responsables y la lista de artículos asignados.
* **Método:** `GET`
* **Ruta:** `/spaces/:id`
* **Acceso:** Privado (Requiere token JWT con rol de `ADMINISTRADOR` o `RESPONSABLE_DE_BIENES`)
* **Respuesta (200 OK):**
  ```json
  {
    "id": "c6783b73-22c5-4524-904a-2585e111ed70",
    "roomNumber": "LAB-4",
    "name": "LABORATORIO DE DESARROLLO DE SOFTWARE 3",
    "type": "LABORATORIO",
    "location": "Piso 2, Bloque B",
    "capacity": 30,
    "jornadas": ["MATUTINA", "NOCTURNA"],
    "createdAt": "2026-07-06T19:40:12.438Z",
    "updatedAt": "2026-07-06T19:40:12.438Z",
    "responsibleTeachers": [],
    "items": [
      {
        "id": "e9c8cf44-4352-4584-a093-ed7fcc931889",
        "name": "cuchillo metalico",
        "codeValue": "codigo003",
        "cantidad": 10,
        "status": "ACTIVO",
        "codeType": {
          "id": "fcbed5d7-51ae-4f4d-af5f-bb9208069164",
          "name": "COGIGO PARA CUCHILLOS",
          "prefix": "CPC"
        }
      }
    ]
  }
  ```

---

### 3. Crear Espacio Físico (Puro)
Crea una nueva aula, oficina o laboratorio de forma limpia (sin asignar docentes ni elementos inicialmente).
* **Método:** `POST`
* **Ruta:** `/spaces`
* **Acceso:** Privado (Requiere token JWT con rol de `ADMINISTRADOR` o `RESPONSABLE_DE_BIENES`)
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "roomNumber": "LAB-4",
    "name": "Laboratorio de Desarrollo de Software 3",
    "type": "LABORATORIO",
    "location": "Piso 2, Bloque B",
    "capacity": 30,
    "jornadas": ["MATUTINA", "NOCTURNA"]
  }
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "id": "c6783b73-22c5-4524-904a-2585e111ed70",
    "roomNumber": "LAB-4",
    "name": "LABORATORIO DE DESARROLLO DE SOFTWARE 3",
    "type": "LABORATORIO",
    "location": "Piso 2, Bloque B",
    "capacity": 30,
    "jornadas": ["MATUTINA", "NOCTURNA"],
    "createdAt": "2026-07-06T19:40:12.438Z",
    "updatedAt": "2026-07-06T19:40:12.438Z",
    "responsibleTeachers": []
  }
  ```

---

### 4. Editar Espacio Físico (Campos Opcionales)
Permite actualizar parcialmente los datos de un espacio físico. Ningún campo es obligatorio en el cuerpo de la petición.
* **Método:** `PATCH`
* **Ruta:** `/spaces/:id`
* **Acceso:** Privado (Requiere token JWT con rol de `ADMINISTRADOR` o `RESPONSABLE_DE_BIENES`)
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "capacity": 35
  }
  ```
* **Respuesta (200 OK):**
  *(Retorna el objeto del espacio actualizado).*

---

### 5. Eliminar Espacio Físico
Elimina el aula de la base de datos si no cuenta con docentes o artículos vinculados.
* **Método:** `DELETE`
* **Ruta:** `/spaces/:id`
* **Acceso:** Privado (Requiere token JWT con rol de `ADMINISTRADOR` o `RESPONSABLE_DE_BIENES`)
* **Respuesta Exitosa (200 OK):**
  ```json
  {
    "message": "Espacio físico eliminado correctamente."
  }
  ```
* **Respuesta Fallida si tiene elementos vinculados (400 Bad Request):**
  ```json
  {
    "statusCode": 400,
    "message": "No se puede eliminar el espacio físico porque tiene docentes responsables o artículos de inventario vinculados. Desvincúlelos primero.",
    "error": "Bad Request"
  }
  ```

---

### 6. Vincular Docentes Responsables
Asigna uno o varios docentes al aula. Valida que el docente esté activo.
* **Método:** `POST`
* **Ruta:** `/spaces/:id/teachers`
* **Acceso:** Privado (Requiere token JWT con rol de `ADMINISTRADOR` o `RESPONSABLE_DE_BIENES`)
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "teacherIds": ["f15422fd-a8c4-408e-9f09-3a7ad7ea1c84"]
  }
  ```
* **Respuesta Exitosa (200 OK):**
  ```json
  {
    "message": "Docentes vinculados al espacio físico correctamente."
  }
  ```
* **Respuesta Fallida si el docente está inactivo (400 Bad Request):**
  ```json
  {
    "statusCode": 400,
    "message": "El docente 'PEDRO ALBERTO ARCOS' está inactivo (INACTIVO). Motivo: \"De vacaciones médicas hasta el 15 de julio.\"",
    "error": "Bad Request"
  }
  ```

---

### 7. Desvincular un Docente Responsable
* **Método:** `DELETE`
* **Ruta:** `/spaces/:id/teachers/:teacherId`
* **Acceso:** Privado (Requiere token JWT con rol de `ADMINISTRADOR` o `RESPONSABLE_DE_BIENES`)
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Docente desvinculado del espacio físico correctamente."
  }
  ```

---

### 8. Asignar Elementos del Inventario (Fraccionamiento de Insumos)
Permite asociar elementos del inventario al aula física. Soporta el descuento automático de cantidades si es un insumo consumible.
* **Método:** `POST`
* **Ruta:** `/spaces/:id/items`
* **Acceso:** Privado (Requiere token JWT con rol de `ADMINISTRADOR` o `RESPONSABLE_DE_BIENES`)
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "items": [
      {
        "itemId": "10024550-30fe-43cd-ba5c-768564174db4", // Cuchillo (Insumo)
        "cantidad": 5
      },
      {
        "itemId": "374101f0-4787-4398-b2cb-a2f7e89f1514" // Teclado (Bien único - cantidad opcional)
      }
    ]
  }
  ```
* **Respuesta Exitosa (200 OK):**
  ```json
  {
    "message": "Elementos del inventario asignados al espacio físico correctamente."
  }
  ```
* **Respuesta Fallida si no hay stock (400 Bad Request):**
  ```json
  {
    "statusCode": 400,
    "message": "Cantidad insuficiente de 'cuchillo metalico'. Cantidad disponible en inventario: 0.",
    "error": "Bad Request"
  }
  ```

---

### 9. Desasociar un Elemento del Espacio Físico (Consolidación)
Libera el bien único o consolida el stock del insumo devolviéndolo a bodega.
* **Método:** `DELETE`
* **Ruta:** `/spaces/:id/items/:itemId`
* **Acceso:** Privado (Requiere token JWT con rol de `ADMINISTRADOR` o `RESPONSABLE_DE_BIENES`)
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Elemento del inventario desasociado del espacio físico correctamente."
  }
  ```

---

### 10. Consultar Inventario del Espacio por Jornada
Retorna la lista de artículos asignados al espacio físico junto con el estado físico, observaciones y novedades de la jornada académica.
* **Método:** `GET`
* **Ruta:** `/spaces/:id/inventory`
* **Acceso:** Privado (Requiere token JWT con rol de `ADMINISTRADOR` o `RESPONSABLE_DE_BIENES`)
* **Parámetros Query (Obligatorio):**
  * `jornada`: La jornada académica a consultar (`MATUTINA`, `VESPERTINA`, `NOCTURNA`).
* **Respuesta (200 OK):**
  ```json
  [
    {
      "id": "e9c8cf44-4352-4584-a093-ed7fcc931889",
      "name": "cuchillo metalico",
      "codeValue": "codigo003",
      "codeType": {
        "id": "fcbed5d7-51ae-4f4d-af5f-bb9208069164",
        "name": "COGIGO PARA CUCHILLOS"
      },
      "cantidad": 10,
      "jornada": "MATUTINA",
      "estadoFisico": "REGULAR",
      "observacion": "Tiene pequeños rayones.",
      "novedades": "El mango está ligeramente flojo."
    }
  ]
  ```
