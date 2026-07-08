# Módulo de Inventario Asignado (Docente)

Este documento detalla las especificaciones de los endpoints del backend para la consulta del inventario institucional (bienes públicos, insumos y suministros, y material bibliográfico) asignado a los espacios físicos y jornadas bajo la responsabilidad del docente.

---

## Especificación de Endpoints

Todos los endpoints usan el prefijo base: `http://localhost:3000/api`

### 1. Consultar Inventario Asignado (con Filtros)
Permite al docente consultar el inventario asignado a las aulas bajo su responsabilidad.
*   **Método:** `GET`
*   **Ruta:** `/spaces/assigned-inventory/items`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`, `DOCENTE`)
*   **Restricción de Seguridad:** Si el usuario es de rol `DOCENTE`, la consulta se filtra de forma forzosa mostrando únicamente los artículos asignados a espacios físicos donde él está registrado como responsable. Los administradores y responsables de bienes visualizan todo el inventario asignado del sistema.
*   **Parámetros de Consulta (Opcionales):**
    *   `spaceId` (UUID) - Filtrar por un aula física en específico (si es docente, debe pertenecer a su lista de aulas asignadas).
    *   `jornada` (string) - Filtrar por jornada académica (`MATUTINA`, `VESPERTINA`, `NOCTURNA`). Si se provee, retorna el estado físico y novedades de la bitácora del turno correspondiente.
    *   `categoryId` (UUID) - Filtrar por categoría.
    *   `subcategoryId` (UUID) - Filtrar por subcategoría.
    *   `codeTypeId` (UUID) - Filtrar por tipo de código.
*   **Respuesta (200 OK - Sin Filtro de Jornada):**
    ```json
    [
      {
        "id": "33333333-0000-4000-a000-000000000001",
        "name": "ASSIGNED-ITEM-1",
        "codeValue": "TST-ASN-001",
        "codeType": "CODIGO PRUEBA",
        "category": "CATEGORIA A",
        "subcategory": "SUBCATEGORIA A",
        "view": "Bienes Públicos",
        "spaceId": "11111111-1111-1111-1111-111111111aaa",
        "roomNumber": "LAB-A",
        "spaceName": "Laboratorio A Asignado",
        "cantidad": 1,
        "status": "ACTIVO"
      }
    ]
    ```
*   **Respuesta (200 OK - Con Filtro de Jornada):**
    ```json
    [
      {
        "id": "33333333-0000-4000-a000-000000000001",
        "name": "ASSIGNED-ITEM-1",
        "codeValue": "TST-ASN-001",
        "codeType": "CODIGO PRUEBA",
        "category": "CATEGORIA A",
        "subcategory": "SUBCATEGORIA A",
        "view": "Bienes Públicos",
        "spaceId": "11111111-1111-1111-1111-111111111aaa",
        "roomNumber": "LAB-A",
        "spaceName": "Laboratorio A Asignado",
        "cantidad": 1,
        "jornada": "MATUTINA",
        "estadoFisico": "BUENO",
        "observacion": null,
        "novedades": null
      }
    ]
    ```

---

### 2. Consultar Detalle de un Elemento del Inventario
Obtiene la información detallada de un bien público, insumo o material bibliográfico, mostrando todos los campos (incluidos los dinámicos/personalizados según su tipo de código).
*   **Método:** `GET`
*   **Ruta:** `/inventory/items/:id`
*   **Acceso:** Privado (Roles `ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`, `DOCENTE`)
*   **Restricción de Seguridad:** Si el usuario es de rol `DOCENTE`, solo puede acceder al detalle de artículos que estén asignados a espacios físicos bajo su responsabilidad o en bodega (`physicalSpaceId` nulo para solicitudes). De lo contrario, se bloquea con un error `403 Forbidden` ("No tienes permiso para ver los detalles de este artículo...").
*   **Respuesta (200 OK):**
    ```json
    {
      "id": "33333333-0000-4000-a000-000000000001",
      "name": "ASSIGNED-ITEM-1",
      "status": "ACTIVO",
      "isPending": false,
      "cantidad": 1,
      "codeValue": "TST-ASN-001",
      "physicalSpaceId": "11111111-1111-1111-1111-111111111aaa",
      "inventoryView": {
        "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb11",
        "name": "Bienes Públicos",
        "code": "BIENES_PUBLICOS"
      },
      "subcategory": {
        "id": "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1aaa1",
        "name": "SUBCATEGORIA A",
        "category": {
          "id": "c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1aaa1",
          "name": "CATEGORIA A"
        }
      },
      "codeType": {
        "id": "f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f11111",
        "name": "CODIGO PRUEBA",
        "prefix": "TST",
        "configs": []
      },
      "physicalSpace": {
        "id": "11111111-1111-1111-1111-111111111aaa",
        "roomNumber": "LAB-A",
        "name": "Laboratorio A Asignado"
      },
      "disponible": false,
      "mensajeDisponibilidad": "Asignado al espacio 'Laboratorio A Asignado' (Número LAB-A)",
      "distribucionEspacios": [],
      "resolvedValues": {}
    }
    ```
