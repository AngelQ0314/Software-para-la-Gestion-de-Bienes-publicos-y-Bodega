# Sistema de Gestión de Bienes Públicos y Bodega — Backend

Este es el backend del sistema de gestión de bienes públicos, insumos de bodega y recursos de biblioteca para el **Instituto Superior Tecnológico Yavirac**. Está desarrollado utilizando **NestJS**, **TypeORM** y **PostgreSQL**.

---

## 🚀 Tecnologías y Herramientas

- **Framework:** NestJS (Node.js)
- **Base de Datos:** PostgreSQL
- **ORM:** TypeORM
- **Autenticación:** JWT y control de accesos basado en Roles (`ADMINISTRADOR`, `RESPONSABLE_DE_BIENES`, `DOCENTE_RESPONSABLE`)
- **Validaciones:** `class-validator` y `class-transformer`

---

## 🛠️ Configuración y Ejecución

### Requisitos Previos

- Node.js (v18+)
- PostgreSQL (Base de datos configurada, ej: `BienesPublicosBodega_BaseDeDatos`)

### Configuración del Entorno (`.env.development`)

Crea o edita un archivo `.env.development` en la raíz del backend con los siguientes parámetros:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=0314
DB_NAME=BienesPublicosBodega_BaseDeDatos
JWT_SECRET=tu_secreto_super_seguro
# Configuración de Mailer
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=tu-correo@yavirac.edu.ec
MAIL_PASSWORD=tu-contraseña-aplicacion
MAIL_FROM_NAME="Inventario Yavirac"
```

### Comandos de Ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar servidor en modo desarrollo (watch mode)
npm run start:dev

# 3. Crear usuario administrador inicial (Seed)
node seed-admin.js
```

---

## 📐 Arquitectura del Catálogo y Campos Dinámicos

La lógica de tipos de código heredada fue removida completamente para dar paso a una estructura simplificada y modular, donde la flexibilidad de atributos técnicos reside directamente en las **subcategorías**.

### 1. Vistas Principales (Inventory Views)
El inventario se organiza en tres vistas principales del instituto:
- `BIENES_PUBLICOS`: Gestión de activos fijos, tecnología y herramientas.
- `INSUMOS`: Suministros de oficina, materiales consumibles y bodega en general.
- `BIBLIOTECA`: Libros, enciclopedias y material didáctico.

### 2. Jerarquía de Clasificación
- **Categorías:** Clasificaciones amplias asignadas a cada vista principal.
- **Subcategorías:** Clasificación de segundo nivel que pertenece a una categoría y determina las especificaciones técnicas o atributos dinámicos necesarios.

### 3. Sistema de Campos Dinámicos (Custom Fields)
Cada **Subcategoría** puede tener asociada una lista de campos personalizados (ej. *Marca, RAM, Procesador, ISBN, Edición, etc.*) mediante la entidad `CustomFieldConfig`.

- **Tipos de datos soportados:**
  - `TEXT` (Texto corto)
  - `NUMBER_INT` (Número entero)
  - `NUMBER_DECIMAL` (Número decimal)
  - `DATE` (Fecha)
  - `OPTIONS_LIST` (Lista de opciones predefinidas)
- Cada asociación de campo dinámico puede ser configurada como **Obligatoria (`isMandatory`)** o tener un **Orden de Visualización (`sortOrder`)** específico.

### 4. Estructura de Datos de Artículos (`InventoryItem`)
Los artículos se guardan con sus propiedades estándar (nombre, código Yavirac, cantidad, estado físico, subcategoría) y guardan sus valores variables en una columna tipo `JSONB` llamada `dynamicValues`.

- Al registrar o actualizar un artículo, el backend valida y limpia automáticamente los valores de `dynamicValues` según la configuración actual de su subcategoría, eliminando llaves obsoletas que ya no formen parte de la subcategoría.
- Al eliminar una subcategoría, todos sus artículos asociados quedan en estado **Sin Clasificar** (`subcategoryId = null`) y sus campos dinámicos son purgados para garantizar la consistencia.

---

## 📦 Estructura del Código Fuente (`/src`)

- `/auth`: Guardia de roles, autenticación JWT, login y cambio de contraseña.
- `/inventory`: Módulo principal que gestiona categorías, subcategorías, campos dinámicos, subida masiva de Excel, y el CRUD de artículos.
- `/spaces`: Gestión de espacios físicos (aulas, laboratorios) y asignación de ítems en jornadas y horarios.
- `/requests`: Sistema de traspaso, solicitud y entrega de bienes e insumos.
- `/reports`: Generación de historiales de novedades y reportes de cierres de período académico.
- `/periods`: Gestión de períodos lectivos (estados de períodos activos/cerrados).
