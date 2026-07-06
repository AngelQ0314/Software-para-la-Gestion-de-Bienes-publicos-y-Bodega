# Módulo de Configuración de Inventario

Este documento describe las especificaciones, la estructura jerárquica de niveles y los detalles técnicos de todos los endpoints del **Módulo de Configuración de Inventario** para el Sistema de Gestión de Bienes Públicos y Bodega.

---

## Especificación de Endpoints

Todos los endpoints usan el prefijo base: `http://localhost:3000/api`

---

## 1. Vistas de Inventario (Nivel 1)
Base estructural fija del sistema (Bienes Públicos, Insumos, Biblioteca).

### 1.1 Obtener Vistas de Inventario
Retorna las tres categorías base fijas preconfiguradas del sistema.
* **Método:** `GET`
* **Ruta:** `/inventory/views`
* **Acceso:** Privado (Cualquier rol. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Respuesta (200 OK):**
  ```json
  [
    {
      "id": "e305e7cc-8b43-41fa-8a8b-3e5fbfba05a1",
      "name": "Bienes Públicos",
      "code": "BIENES_PUBLICOS"
    },
    {
      "id": "f512a8bb-9b34-42f0-9b8b-4a5fbfca06b2",
      "name": "Insumos y Suministros",
      "code": "INSUMOS"
    },
    {
      "id": "d128d7ee-0a56-43d9-9a2c-5e5fbfda07c3",
      "name": "Biblioteca",
      "code": "BIBLIOTECA"
    }
  ]
  ```

---

## 2. Categorías (Nivel 2)
Secciones agrupadoras dentro de cada vista (ej. Periféricos, Muebles).

### 2.1 Obtener Categorías
Lista todas las categorías registradas con sus subcategorías anidadas.
* **Método:** `GET`
* **Ruta:** `/inventory/categories`
* **Acceso:** Privado (Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Parámetros Query:**
  * `inventoryViewId` (Opcional): Filtra las categorías pertenecientes a una vista específica.
* **Respuesta (200 OK):**
  ```json
  [
    {
      "id": "18ac2b56-78ab-4cfc-9b87-9bc451b0f5cd",
      "name": "PERIFÉRICOS",
      "inventoryViewId": "e305e7cc-8b43-41fa-8a8b-3e5fbfba05a1",
      "inventoryView": {
        "id": "e305e7cc-8b43-41fa-8a8b-3e5fbfba05a1",
        "name": "Bienes Públicos",
        "code": "BIENES_PUBLICOS"
      },
      "subcategories": [
        {
          "id": "89ef4cda-12bc-4fa8-bb98-9cd562c1d6ef",
          "name": "TECLADOS"
        }
      ]
    }
  ]
  ```

### 2.2 Crear Categoría
Permite al administrador crear una nueva categoría asociada a una vista de inventario.
* **Método:** `POST`
* **Ruta:** `/inventory/categories`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Cuerpo de la Petición (Request Body):**
  * *Puedes enviar `inventoryViewId` (UUID) o `inventoryViewCode` (código legible).*
  ```json
  {
    "name": "Periféricos",
    "inventoryViewCode": "BIENES_PUBLICOS" // O valores: 'BIENES_PUBLICOS', 'INSUMOS', 'BIBLIOTECA'
  }
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "id": "18ac2b56-78ab-4cfc-9b87-9bc451b0f5cd",
    "name": "PERIFÉRICOS",
    "inventoryViewId": "e305e7cc-8b43-41fa-8a8b-3e5fbfba05a1",
    "createdAt": "2026-07-01T12:00:00.000Z",
    "updatedAt": "2026-07-01T12:00:00.000Z"
  }
  ```

### 2.3 Editar Categoría
Modifica el nombre de una categoría existente.
* **Método:** `PATCH`
* **Ruta:** `/inventory/categories/:id`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "name": "Periféricos de Entrada"
  }
  ```
* **Respuesta (200 OK):**
  ```json
  {
    "id": "18ac2b56-78ab-4cfc-9b87-9bc451b0f5cd",
    "name": "PERIFÉRICOS DE ENTRADA",
    "inventoryViewId": "e305e7cc-8b43-41fa-8a8b-3e5fbfba05a1"
  }
  ```

### 2.4 Eliminar Categoría
Elimina una categoría completa junto con todas sus subcategorías. Los bienes asociados se desvinculan (quedan huérfanos sin categoría/vista) en lugar de borrarse.
* **Método:** `DELETE`
* **Ruta:** `/inventory/categories/:id`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Categoría eliminada correctamente. 5 elementos se desasociaron y quedaron sin categoría."
  }
  ```

---

## 3. Subcategorías (Nivel 3)
Subdivisiones de cada categoría (ej. Teclados, Mouses).

### 3.1 Obtener Subcategorías
Retorna la lista de todas las subcategorías con sus categorías y vistas anidadas.
* **Método:** `GET`
* **Ruta:** `/inventory/subcategories`
* **Acceso:** Privado (Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Parámetros Query:**
  * `categoryId` (Opcional): Filtra las subcategorías pertenecientes a una categoría específica.
* **Respuesta (200 OK):**
  ```json
  [
    {
      "id": "89ef4cda-12bc-4fa8-bb98-9cd562c1d6ef",
      "name": "TECLADOS",
      "categoryId": "18ac2b56-78ab-4cfc-9b87-9bc451b0f5cd",
      "category": {
        "id": "18ac2b56-78ab-4cfc-9b87-9bc451b0f5cd",
        "name": "PERIFÉRICOS",
        "inventoryView": {
          "id": "e305e7cc-8b43-41fa-8a8b-3e5fbfba05a1",
          "name": "Bienes Públicos"
        }
      }
    }
  ]
  ```

### 3.2 Crear Subcategoría
Crea una nueva subcategoría enlazada a una categoría padre.
* **Método:** `POST`
* **Ruta:** `/inventory/subcategories`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Cuerpo de la Petición (Request Body):**
  * *Puedes enviar `categoryId` (UUID) o `categoryName` (nombre legible).*
  ```json
  {
    "name": "Teclados",
    "categoryName": "Periféricos"
  }
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "id": "89ef4cda-12bc-4fa8-bb98-9cd562c1d6ef",
    "name": "TECLADOS",
    "categoryId": "18ac2b56-78ab-4cfc-9b87-9bc451b0f5cd",
    "createdAt": "2026-07-01T12:00:00.000Z",
    "updatedAt": "2026-07-01T12:00:00.000Z"
  }
  ```

### 3.3 Editar Subcategoría
Modifica el nombre o reasocia la subcategoría a otra categoría.
* **Método:** `PATCH`
* **Ruta:** `/inventory/subcategories/:id`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Cuerpo de la Petición (Request Body):**
  * *Permite usar `categoryId` o `categoryName` para la reasociación.*
  ```json
  {
    "name": "Teclados Mecánicos",
    "categoryName": "Periféricos de Entrada"
  }
  ```
* **Respuesta (200 OK):**
  ```json
  {
    "id": "89ef4cda-12bc-4fa8-bb98-9cd562c1d6ef",
    "name": "TECLADOS MECÁNICOS",
    "categoryId": "nueva-categoria-uuid"
  }
  ```

### 3.4 Eliminar Subcategoría
Remueve una subcategoría de la base de datos. Los bienes asociados se desvinculan (quedan huérfanos sin subcategoría/vista) en lugar de borrarse.
* **Método:** `DELETE`
* **Ruta:** `/inventory/subcategories/:id`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Subcategoría eliminada correctamente. 3 elementos se desasociaron y quedaron sin subcategoría."
  }
  ```

---

## 4. Tipos de Código (Identificación)
Catálogo de etiquetas de identificación física (ej. Código SECAP, Código QR).

### 4.1 Obtener Tipos de Código
Lista todos los tipos de códigos registrados en el sistema.
* **Método:** `GET`
* **Ruta:** `/inventory/code-types`
* **Acceso:** Privado (Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Respuesta (200 OK):**
  ```json
  [
    {
      "id": "code-type-uuid-1",
      "name": "CÓDIGO QR TECLADOS",
      "prefix": "QR-TEC-"
    }
  ]
  ```

### 4.2 Crear Tipo de Código
Registra un nuevo tipo de identificador y prefijo sugerido.
* **Método:** `POST`
* **Ruta:** `/inventory/code-types`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "name": "Código QR Teclados",
    "prefix": "QR-TEC-"
  }
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "id": "code-type-uuid-1",
    "name": "CÓDIGO QR TECLADOS",
    "prefix": "QR-TEC-"
  }
  ```

### 4.3 Editar Tipo de Código
Edita el nombre o prefijo de un tipo de código.
* **Método:** `PATCH`
* **Ruta:** `/inventory/code-types/:id`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "name": "Código QR Teclados V2",
    "prefix": "QR-TECV2-"
  }
  ```
* **Respuesta (200 OK):**
  ```json
  {
    "id": "code-type-uuid-1",
    "name": "CÓDIGO QR TECLADOS V2",
    "prefix": "QR-TECV2-"
  }
  ```

### 4.4 Eliminar Tipo de Código
Elimina un tipo de código de la base de datos.
* **Método:** `DELETE`
* **Ruta:** `/inventory/code-types/:id`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Tipo de código eliminado correctamente."
  }
  ```

---

## 5. Campos Personalizados (Atributos Dinámicos)
Catálogo de campos globales reutilizables.

### 5.1 Obtener Campos Personalizados
Obtiene la lista global de campos creados en el sistema.
* **Método:** `GET`
* **Ruta:** `/inventory/custom-fields`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Respuesta (200 OK):**
  ```json
  [
    {
      "id": "campo-uuid-marca",
      "name": "marca",
      "label": "Marca del Dispositivo",
      "type": "OPTIONS_LIST",
      "options": ["Dell", "Genius", "HP", "Lenovo"]
    }
  ]
  ```

### 5.2 Crear Campo Personalizado
Define un nuevo metadato global en la base de datos.
* **Método:** `POST`
* **Ruta:** `/inventory/custom-fields`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "name": "marca",
    "label": "Marca del Dispositivo",
    "type": "OPTIONS_LIST", // Valores válidos: TEXT, NUMBER_INT, NUMBER_DECIMAL, DATE, OPTIONS_LIST
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "id": "campo-uuid-marca",
    "name": "marca",
    "label": "Marca del Dispositivo",
    "type": "OPTIONS_LIST",
    "options": ["Dell", "Genius", "HP", "Lenovo"]
  }
  ```

### 5.3 Editar Campo Personalizado
Edita un campo personalizado existente de forma global.
* **Método:** `PATCH`
* **Ruta:** `/inventory/custom-fields/:id`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "label": "Marca del Computador",
    "options": ["Dell", "Genius", "HP", "Lenovo", "Apple"]
  }
  ```
* **Respuesta (200 OK):**
  ```json
  {
    "id": "campo-uuid-marca",
    "name": "marca",
    "label": "Marca del Computador",
    "type": "OPTIONS_LIST",
    "options": ["Dell", "Genius", "HP", "Lenovo", "Apple"]
  }
  ```

### 5.4 Eliminar Campo Personalizado
Elimina un campo personalizado globalmente. Esto removerá en cascada todas sus asociaciones de esquemas con los tipos de código.
* **Método:** `DELETE`
* **Ruta:** `/inventory/custom-fields/:id`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Campo personalizado eliminado correctamente."
  }
  ```

---

## 6. Asociación de Esquemas (Campos ↔ Códigos)
Vincula qué atributos le pertenecen a cada plantilla de entrada.

### 6.1 Asociar Campo a Tipo de Código
Vincula un atributo dinámico a un tipo de código, indicando obligatoriedad y orden en el formulario.
* **Método:** `POST`
* **Ruta:** `/inventory/code-types/:id/fields` (donde `:id` es el UUID del Tipo de Código, ej: `d46e3223-69b8-4cb0-8b79-c11336b48096`)
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Cuerpo de la Petición (Request Body):**
  * *Puedes enviar `customFieldId` (UUID) o `customFieldName` (nombre técnico legible del campo, ej: `"marca"`).*
  ```json
  {
    "customFieldName": "marca", // O usar "customFieldId": "UUID_DEL_CAMPO"
    "isMandatory": true,
    "sortOrder": 1
  }
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "id": "config-uuid-1",
    "codeTypeId": "code-type-uuid-1",
    "customFieldId": "campo-uuid-marca",
    "isMandatory": true,
    "sortOrder": 1
  }
  ```

### 6.2 Obtener Campos Asociados (Formulario Dinámico)
* **Método:** `GET`
* **Ruta:** `/inventory/code-types/:id/fields`
* **Acceso:** Privado (Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Respuesta (200 OK):**
  ```json
  [
    {
      "id": "campo-uuid-marca",
      "name": "marca",
      "label": "Marca del Dispositivo",
      "type": "OPTIONS_LIST",
      "options": ["Dell", "Genius", "HP", "Lenovo"],
      "isMandatory": true,
      "sortOrder": 1
    }
  ]
  ```

### 6.3 Desasociar Campo de Tipo de Código
Desvincula un campo personalizado de un tipo de código específico.
* **Método:** `DELETE`
* **Ruta:** `/inventory/code-types/:codeTypeId/fields/:customFieldId`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Asociación del campo eliminada correctamente."
  }
  ```

---

## 7. Elementos del Inventario (Nivel 4)
Artículos físicos finales registrados en el sistema.

### 7.1 Registrar Elemento
Registra físicamente un bien o insumo en el inventario.
* **Método:** `POST`
* **Ruta:** `/inventory/items`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Cuerpo de la Petición (Request Body):**
  * *Puedes enviar `subcategoryId` (UUID) o `subcategoryName` (nombre legible), así como `codeTypeId` (UUID) o `codeTypeName` (nombre legible).*
  ```json
  {
    "subcategoryName": "Teclados", // O usar "subcategoryId": "89ef4cda-12bc-4fa8-bb98-9cd562c1d6ef"
    "codeTypeName": "CÓDIGO SECAP", // O usar "codeTypeId": "d46e3223-69b8-4cb0-8b79-c11336b48096"
    "codeValue": "QR-TEC-0001", // Opcional
    "name": "Teclado Genius SlimStar",
    "cantidad": 1, // Opcional (Obligatorio en Suministros/Insumos)
    "dynamicValues": {
      "marca": "Genius"
    }
  }
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "id": "item-uuid-1",
    "name": "Teclado Genius SlimStar",
    "codeValue": "QR-TEC-0001",
    "subcategoryId": "89ef4cda-12bc-4fa8-bb98-9cd562c1d6ef",
    "codeTypeId": "d46e3223-69b8-4cb0-8b79-c11336b48096",
    "inventoryViewId": "e305e7cc-8b43-41fa-8a8b-3e5fbfba05a1",
    "cantidad": 1,
    "dynamicValues": {
      "3235ca05-bff0-4cb4-a213-607f554491c1": "Genius"
    },
    "status": "ACTIVO",
    "createdAt": "2026-07-01T12:00:00.000Z",
    "updatedAt": "2026-07-01T12:00:00.000Z"
  }
  ```

### 7.2 Obtener Listado de Elementos (Filtrado y Paginación)
* **Método:** `GET`
* **Ruta:** `/inventory/items`
* **Acceso:** Privado (Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Parámetros Query (Opcionales):**
  * `inventoryViewId`, `categoryId`, `subcategoryId`, `codeTypeId`
  * `status`: Filtra por `ACTIVO` o `INACTIVO`. *Si se omite, por defecto lista únicamente los `ACTIVO`*.
  * `search`: Búsqueda de texto sobre Nombre y Código de Barras/QR.
  * `page`, `limit` (Paginación).
* **Respuesta (200 OK):**
  ```json
  {
    "data": [
      {
        "id": "b9dd015b-5664-4682-a123-c6890b759460",
        "inventoryViewId": "d8e5a15b-b326-453f-8314-361ba321d6c5",
        "inventoryView": {
          "id": "d8e5a15b-b326-453f-8314-361ba321d6c5",
          "name": "Bienes Públicos",
          "code": "BIENES_PUBLICOS"
        },
        "subcategoryId": "7e0de43c-af36-477a-8443-42352dccafc3",
        "subcategory": {
          "id": "7e0de43c-af36-477a-8443-42352dccafc3",
          "name": "PERIFERICOS",
          "categoryId": "ecc3519c-99f7-43f4-9857-f0e7ea25fb93",
          "category": {
            "id": "ecc3519c-99f7-43f4-9857-f0e7ea25fb93",
            "name": "EQUIPOS DE COMPUTO",
            "inventoryViewId": "d8e5a15b-b326-453f-8314-361ba321d6c5"
          }
        },
        "codeTypeId": "d46e3223-69b8-4cb0-8b79-c11336b48096",
        "codeType": {
          "id": "d46e3223-69b8-4cb0-8b79-c11336b48096",
          "name": "COGIGO SECAP",
          "prefix": "SECAP"
        },
        "codeValue": "QTR-002",
        "name": "Teclado2",
        "cantidad": 1,
        "dynamicValues": {
          "3235ca05-bff0-4cb4-a213-607f554491c1": "Genius",
          "40fa671f-3e8a-416e-b41a-f3cf2b8c1f16": "En la planta baja"
        },
        "status": "ACTIVO",
        "createdAt": "2026-07-01T18:46:36.813Z",
        "updatedAt": "2026-07-01T18:46:36.813Z",
        "deletedAt": null
      }
    ],
    "total": 1,
    "page": 1,
    "lastPage": 1
  }
  ```

### 7.3 Obtener Elemento por ID (Con Valores Resueltos)
Retorna la información completa de un artículo y la traducción de sus variables JSONB dinámicas a etiquetas legibles de texto.
* **Método:** `GET`
* **Ruta:** `/inventory/items/:id`
* **Acceso:** Privado (Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Respuesta (200 OK):**
  ```json
  {
    "id": "b9dd015b-5664-4682-a123-c6890b759460",
    "inventoryViewId": "d8e5a15b-b326-453f-8314-361ba321d6c5",
    "inventoryView": {
      "id": "d8e5a15b-b326-453f-8314-361ba321d6c5",
      "name": "Bienes Públicos",
      "code": "BIENES_PUBLICOS"
    },
    "subcategoryId": "7e0de43c-af36-477a-8443-42352dccafc3",
    "subcategory": {
      "id": "7e0de43c-af36-477a-8443-42352dccafc3",
      "name": "PERIFERICOS",
      "categoryId": "ecc3519c-99f7-43f4-9857-f0e7ea25fb93"
    },
    "codeTypeId": "d46e3223-69b8-4cb0-8b79-c11336b48096",
    "codeType": {
      "id": "d46e3223-69b8-4cb0-8b79-c11336b48096",
      "name": "COGIGO SECAP",
      "prefix": "SECAP"
    },
    "codeValue": "QTR-002",
    "name": "Teclado2",
    "cantidad": 1,
    "dynamicValues": {
      "3235ca05-bff0-4cb4-a213-607f554491c1": "Genius",
      "40fa671f-3e8a-416e-b41a-f3cf2b8c1f16": "En la planta baja"
    },
    "status": "ACTIVO",
    "createdAt": "2026-07-01T18:46:36.813Z",
    "updatedAt": "2026-07-01T18:46:36.813Z",
    "deletedAt": null,
    "resolvedValues": [
      {
        "fieldId": "3235ca05-bff0-4cb4-a213-607f554491c1",
        "fieldName": "marca",
        "label": "Marca del Dispositivo",
        "type": "OPTIONS_LIST",
        "value": "Genius"
      },
      {
        "fieldId": "40fa671f-3e8a-416e-b41a-f3cf2b8c1f16",
        "fieldName": "ubicacion",
        "label": "Ubicación del Dispositivo",
        "type": "TEXT",
        "value": "En la planta baja"
      }
    ]
  }
  ```

### 7.4 Editar Elemento (Actualización Parcial / Merge)
Permite modificar campos específicos, incluyendo su estado. Realiza una fusión inteligente en los campos dinámicos para no sobreescribir ni dañar el resto del historial.
* **Método:** `PATCH`
* **Ruta:** `/inventory/items/:id`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Cuerpo de la Petición (Request Body):**
  ```json
  {
    "name": "Teclado Genius SlimStar V2",
    "cantidad": 5, // Opcional para re-definir stock
    "dynamicValues": {
      "marca": "Dell"
    }
  }
  ```
* **Respuesta (200 OK):**
  ```json
  {
    "id": "item-uuid-1",
    "name": "Teclado Genius SlimStar V2",
    "codeValue": "QR-TEC-0001",
    "cantidad": 5,
    "status": "ACTIVO",
    "dynamicValues": {
      "3235ca05-bff0-4cb4-a213-607f554491c1": "Dell"
    }
  }
  ```

### 7.5 Eliminar Elemento (Borrado Lógico)
Desactiva el elemento del inventario cambiando su estado a `INACTIVO` y estableciendo la fecha de borrado lógico (`deletedAt`).
* **Método:** `DELETE`
* **Ruta:** `/inventory/items/:id`
* **Acceso:** Privado (Solo ADMINISTRADOR. Requiere cabecera `Authorization: Bearer <TOKEN>`)
* **Respuesta (200 OK):**
  ```json
  {
    "message": "Elemento eliminado del inventario correctamente."
  }
  ```
