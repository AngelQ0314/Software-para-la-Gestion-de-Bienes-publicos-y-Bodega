# Sistema de Gestión de Bienes Públicos y Bodega - IST Yavirac

Este repositorio contiene el código fuente para el **Sistema de Gestión de Bienes Públicos y Bodega** del Instituto Superior Tecnológico Yavirac. El backend está construido sobre NestJS (Node.js) utilizando TypeScript y TypeORM para la persistencia en PostgreSQL.

---

## Estructura de Documentación de Endpoints

Para facilitar la integración con el frontend (Angular), la documentación de la API está dividida por módulos funcionales:

*   [Módulo de Autenticación y Perfil (README_AUTH.md)](./README_AUTH.md) - Inicio de sesión, recuperación de contraseña, cambio de contraseña obligatoria y voluntaria, y validación de tokens.
*   [Módulo de Administración de Usuarios (README_USERS.md)](./README_USERS.md) - Creación de usuarios, filtrado paginado, actualización de roles, cambio de estados con observaciones, bitácora de auditoría (logs) y edición de perfiles.
*   [Módulo de Configuración de Inventario (README_INVENTORY.md)](./README_INVENTORY.md) - Creación y gestión de categorías, subcategorías, tipos de código, campos personalizados y elementos físicos del inventario.
*   [Módulo de Gestión de Espacios Físicos (README_SPACES.md)](./README_SPACES.md) - Administración de aulas, laboratorios y oficinas, asignación de docentes responsables, asignación de inventario y seguimiento de estado independiente por jornada académica.

---

## Guía de Instalación y Configuración del Backend

Sigue estos pasos para levantar el servidor backend localmente en tu computadora:

### 1. Requisitos Previos
Asegúrate de tener instalado en tu computadora:
*   [Node.js](https://nodejs.org/) (Versión 18 o superior recomendada).
*   [PostgreSQL](https://www.postgresql.org/) (Base de datos relacional).

### 2. Configurar la Base de Datos
1.  Abre tu gestor de base de datos (pgAdmin o terminal).
2.  Crea una nueva base de datos llamada: `BienesPublicosBodega_BaseDeDatos`
3.  Asegúrate de que tu usuario de PostgreSQL sea `postgres` y tenga una contraseña (por ejemplo, `0314`).

### 3. Instalar Dependencias
Abre una terminal, navega a la carpeta `/backend` e instala las dependencias del proyecto:
```bash
cd backend
npm install
```

### 4. Configurar Variables de Entorno (.env)
Los archivos de configuración de variables de entorno (`.env.development` para el entorno local y `.env.production` para el entorno del instituto) son confidenciales y contienen credenciales de base de datos y de correo. 

*   **Acción:** Solicita los archivos `.env.development` y `.env.production` listos y configurados directamente al **personal encargado / autorizado**. Copia el archivo recibido dentro de la raíz de la carpeta `/backend`.

### 5. Sembrar el Administrador Inicial (Seeder)
Para crear el primer usuario `ADMINISTRADOR` que te permita ingresar al panel de control en desarrollo:

*   **Acción:** Solicita el archivo script de siembra `seed-admin.js` (o en su defecto, los parámetros de cédula, correo y contraseña del administrador autorizado) al **personal encargado**.
*   Una vez que tengas el archivo ubicado en la carpeta `/backend`, ejecuta en tu consola:
    ```bash
    node seed-admin.js
    ```

### 6. Iniciar el Servidor de Desarrollo
Para levantar el servidor backend con recarga automática (watch mode), ejecuta:
```bash
npm run start:dev
```
El servidor levantará correctamente en la dirección: [http://localhost:3000/api](http://localhost:3000/api)

---

## Credenciales de Servidores y Correo
Toda la información correspondiente a accesos a bases de datos en producción, servidores de correo SMTP, credenciales de administración inicial y configuraciones adicionales de red son de carácter reservado.

*   Si requieres más información o necesitas acceso a estos componentes, ponte en contacto directo con el **personal encargado / autorizado** de la institución.
