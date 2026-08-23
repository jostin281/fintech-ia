# Fintech Backend

<p align="center">
  <a href="https://nestjs.com/" target="_blank">
    <img src="https://nestjs.com/img/logo-small.svg" width="110" alt="Logo de NestJS" />
  </a>
</p>

<p align="center">
  API REST para administrar finanzas personales, presupuestos, metas de ahorro,
  reportes, notificaciones, asistencia financiera con IA y facturación electrónica
  preparada para integrarse con el Servicio de Rentas Internas (SRI) de Ecuador.
</p>

> **Estado del proyecto:** MVP académico funcional. La integración técnica con el
> SRI está preparada, pero la emisión de extremo a extremo debe validarse en el
> ambiente de pruebas con un RUC y una firma electrónica reales.

## Tabla de contenido

- [Descripción general](#descripción-general)
- [¿Qué problema resuelve?](#qué-problema-resuelve)
- [Funcionalidades principales](#funcionalidades-principales)
- [Cómo funciona el sistema](#cómo-funciona-el-sistema)
- [Arquitectura](#arquitectura)
- [Tecnologías utilizadas](#tecnologías-utilizadas)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Variables de entorno](#variables-de-entorno)
- [Base de datos y Prisma](#base-de-datos-y-prisma)
- [Ejecución del proyecto](#ejecución-del-proyecto)
- [Cómo probar el sistema](#cómo-probar-el-sistema)
- [Pruebas del módulo de facturación](#pruebas-del-módulo-de-facturación)
- [Integración con el SRI](#integración-con-el-sri)
- [Firma electrónica](#firma-electrónica)
- [Integración con Gemini](#integración-con-gemini)
- [Integración con el frontend](#integración-con-el-frontend)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Seguridad](#seguridad)
- [Comandos útiles](#comandos-útiles)
- [Problemas frecuentes](#problemas-frecuentes)
- [Alcance y limitaciones](#alcance-y-limitaciones)
- [Licencia](#licencia)

## Descripción general

Fintech Backend es una API desarrollada con NestJS y TypeScript. Su propósito es
centralizar la información financiera de un usuario y convertirla en datos útiles
para tomar decisiones.

El sistema permite registrar ingresos y gastos, controlar presupuestos, establecer
metas de ahorro, recibir alertas, consultar reportes y conversar con un asistente
financiero. También incorpora un módulo tributario que clasifica movimientos,
estima valores relacionados con impuestos y administra el flujo de facturación
electrónica.

### En palabras normales

El usuario registra el dinero que recibe y el dinero que gasta. A partir de esa
información, el sistema le muestra en qué está gastando, si está excediendo un
presupuesto, cuánto ha ahorrado y cómo se encuentra su situación financiera. Si el
usuario tiene una actividad económica, también puede preparar facturas y organizar
información tributaria.

## ¿Qué problema resuelve?

Muchas personas administran sus finanzas en cuadernos, hojas de cálculo o varias
aplicaciones separadas. Esto dificulta conocer cuánto dinero realmente tienen,
cuánto gastan y si están cumpliendo sus objetivos.

Este proyecto reúne en un solo sistema:

- Registro de ingresos y gastos.
- Organización mediante categorías.
- Presupuestos mensuales.
- Metas de ahorro y aportes.
- Alertas y notificaciones.
- Reportes financieros exportables.
- Análisis mediante inteligencia artificial.
- Perfil y organización tributaria.
- Facturación electrónica preparada para el SRI.

## Funcionalidades principales

### Usuarios y autenticación

- Registro y administración de usuarios.
- Inicio de sesión mediante correo y contraseña.
- Contraseñas almacenadas de forma segura mediante hash.
- Autenticación con token JWT.
- Roles `USUARIO` y `ADMINISTRADOR`.
- Protección de rutas y separación de información por usuario.

### Categorías

- Organización de movimientos en categorías de ingreso o gasto.
- Validación para evitar utilizar una categoría de gasto en un ingreso, o al
  contrario.
- Activación y desactivación lógica para conservar el historial.

### Movimientos

- Registro de ingresos y gastos.
- Consulta por usuario autenticado.
- Filtros por tipo, categoría y periodo.
- Actualización de movimientos propios.
- Eliminación lógica para conservar información histórica.

### Presupuestos

- Definición de límites de gasto por categoría, mes y año.
- Prevención de presupuestos duplicados para el mismo periodo.
- Alertas cuando el consumo se acerca al límite establecido.
- Validación de periodos y categorías de gasto.

### Metas de ahorro y aportes

- Creación de objetivos de ahorro.
- Registro de aportes parciales.
- Seguimiento del monto acumulado y restante.
- Conservación del historial de aportes.

### Notificaciones

- Alertas de presupuesto.
- Recordatorios relacionados con movimientos y pagos.
- Avisos sobre metas de ahorro.
- Recomendaciones financieras generadas por reglas internas.

### Reportes

- Reportes semanales, mensuales y anuales.
- Resumen de ingresos, gastos y balance.
- Agrupación por categorías.
- Exportación en PDF y Excel.

### Asistente financiero con Gemini

- Conversaciones relacionadas con la información financiera del usuario.
- Consultas sobre ingresos, gastos, presupuestos y metas.
- Análisis por periodos.
- Respuestas generadas con Gemini utilizando solamente la información permitida.
- Persistencia de conversaciones y mensajes.

### Facturación y tributación

- Perfil tributario por usuario.
- Administración segura de firma electrónica.
- Clientes de facturación.
- Catálogo de productos y servicios.
- Facturas y detalles.
- Cálculo de descuentos, bases imponibles, IVA y total.
- Secuenciales y claves de acceso.
- Generación de XML y RIDE.
- Flujo de emisión, consulta y reenvío al SRI.
- Registro de retenciones recibidas.
- Clasificación tributaria de categorías financieras.
- Resumen tributario anual.
- Estimación de impuesto a la renta.

## Cómo funciona el sistema

El flujo general de una solicitud es el siguiente:

```mermaid
flowchart LR
    A[Frontend o Postman] --> B[Controller]
    B --> C[DTO y validaciones]
    C --> D[Service]
    D --> E[Prisma Client]
    E --> F[(PostgreSQL)]
    D --> G[Gemini o SRI cuando corresponde]
    D --> B
    B --> A
```

1. El frontend o Postman envía una petición HTTP.
2. El controlador recibe la petición y extrae el usuario autenticado.
3. El DTO valida los datos recibidos.
4. El servicio aplica las reglas del negocio.
5. Prisma consulta o modifica PostgreSQL.
6. Si la operación lo necesita, el servicio se comunica con Gemini o con el SRI.
7. El backend devuelve una respuesta JSON o un archivo.

### Ejemplo: registrar un gasto

1. El usuario inicia sesión y obtiene un token.
2. Envía un movimiento con tipo `GASTO`, monto y categoría.
3. El backend verifica el token.
4. Comprueba que la categoría exista, esté activa y sea de gasto.
5. Guarda el movimiento asociado al usuario.
6. Los presupuestos, reportes y notificaciones pueden utilizar ese movimiento.

### Ejemplo: crear una factura

1. El usuario configura su perfil tributario.
2. Registra un cliente y uno o varios productos.
3. Crea una factura en estado `BORRADOR`.
4. El servidor calcula subtotal, descuento, IVA y total.
5. Cuando se solicita la emisión, genera el XML y la clave de acceso.
6. El XML se firma con el certificado electrónico.
7. El sistema lo envía al SRI y guarda la respuesta.

## Arquitectura

El backend utiliza una arquitectura modular por funcionalidades. Cada módulo puede
contener:

- **Module:** registra controladores, servicios y dependencias.
- **Controller:** declara las rutas HTTP.
- **DTO:** valida y documenta los datos de entrada.
- **Service:** contiene la lógica del negocio.
- **Interface:** define estructuras internas de TypeScript.
- **Utilidad:** concentra operaciones pequeñas y reutilizables.
- **Prueba:** comprueba automáticamente el comportamiento esperado.
- **Prisma:** comunica el servicio con PostgreSQL.

La separación permite modificar una funcionalidad sin convertir el proyecto en un
único archivo difícil de mantener.

## Tecnologías utilizadas

- [Node.js](https://nodejs.org/)
- [NestJS](https://nestjs.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [PostgreSQL](https://www.postgresql.org/)
- [Prisma ORM](https://www.prisma.io/)
- JWT para autenticación.
- `class-validator` y `class-transformer` para validaciones.
- PDFKit para generación de PDF.
- ExcelJS para archivos Excel.
- Gemini API para asistencia financiera.
- Servicios de comprobantes electrónicos del SRI.

## Requisitos previos

Antes de instalar el proyecto se necesita:

- Node.js 24 o una versión compatible con las dependencias.
- npm.
- PostgreSQL 16 o compatible.
- Git.
- Una base de datos local.
- Una API key de Gemini para utilizar el asistente.
- Para pruebas reales del SRI: RUC, certificado electrónico vigente y acceso al
  ambiente de pruebas.

Versiones utilizadas durante el desarrollo:

```text
Node.js: 24.x
npm: 11.x
NestJS CLI: 11.x
TypeScript: 5.9.x
PostgreSQL: 16
Prisma: 7.x
```

## Instalación

### 1. Clonar el repositorio

```bash
git clone URL_DEL_REPOSITORIO
cd fintech-backend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Crear la base de datos

Ejemplo en PostgreSQL:

```sql
CREATE DATABASE fintech_db;
```

El entorno utilizado durante el desarrollo emplea PostgreSQL en el puerto `5433`.
Si tu instalación utiliza `5432`, cambia el puerto en `DATABASE_URL`.

## Variables de entorno

Crea un archivo `.env` en la raíz del backend. Nunca subas este archivo al
repositorio.

Ejemplo de referencia:

```env
DATABASE_URL="postgresql://postgres:CONTRASENA@localhost:5433/fintech_db?schema=public"

JWT_SECRET="CAMBIA_ESTE_SECRETO_POR_UN_VALOR_LARGO_Y_ALEATORIO"
JWT_EXPIRES_IN="1d"

GEMINI_API_KEY="TU_API_KEY_DE_GEMINI"

# Nombre referencial: debe coincidir con el utilizado por el servicio de firma.
FIRMA_ENCRYPTION_KEY="CLAVE_DE_32_BYTES_GESTIONADA_DE_FORMA_SEGURA"

# Mantener en pruebas hasta completar la certificación real.
SRI_AMBIENTE="PRUEBAS"
```

> Los nombres exactos deben coincidir con los consultados por `ConfigService` en
> el código. Para localizarlos puedes ejecutar:

```powershell
Get-ChildItem .\src -Recurse -Filter *.ts |
Select-String -Pattern "ConfigService|process\.env"
```

No publiques:

- Contraseñas de PostgreSQL.
- Secretos JWT.
- API keys.
- Firmas `.p12` o `.pfx`.
- Contraseñas de certificados.
- Credenciales de SRI en Línea.

## Base de datos y Prisma

### Validar el esquema

```bash
npx prisma format
npx prisma validate
```

### Consultar el estado de migraciones

```bash
npx prisma migrate status
```

### Aplicar migraciones en desarrollo

```bash
npx prisma migrate dev
```

Para crear una migración nueva:

```bash
npx prisma migrate dev --name nombre_descriptivo
```

### Generar Prisma Client

```bash
npx prisma generate
```

### Explorar los datos

```bash
npx prisma studio
```

> No utilices `npx prisma migrate reset` si necesitas conservar los datos. Ese
> comando elimina y vuelve a crear las tablas.

## Ejecución del proyecto

### Desarrollo

```bash
npm run start:dev
```

### Ejecución normal

```bash
npm run start
```

### Compilar

```bash
npm run build
```

### Producción

```bash
npm run start:prod
```

La dirección predeterminada normalmente es:

```text
http://localhost:3000
```

Si `main.ts` contiene un prefijo global como:

```ts
app.setGlobalPrefix('api');
```

las rutas comenzarán con:

```text
http://localhost:3000/api
```

## Cómo probar el sistema

Las pruebas manuales pueden realizarse con Postman o Thunder Client.

### Preparar Postman

1. Crear un entorno llamado `Fintech Local`.
2. Crear la variable `baseUrl` con `http://localhost:3000`.
3. Crear la variable `token` vacía.
4. Crear una colección llamada `Fintech Backend`.
5. Configurar `Authorization → Bearer Token` con `{{token}}`.

### Orden general de pruebas

1. Registrar o utilizar un usuario existente.
2. Iniciar sesión.
3. Guardar el token.
4. Consultar categorías.
5. Registrar ingresos y gastos.
6. Crear presupuestos.
7. Crear metas y registrar aportes.
8. Consultar notificaciones.
9. Generar reportes.
10. Probar el asistente con Gemini.
11. Configurar y probar facturación.

### Obtener todas las rutas reales

Para evitar depender de documentación desactualizada:

```powershell
Get-ChildItem .\src -Recurse -Filter *.controller.ts |
Select-String -Pattern '@Controller|@(Get|Post|Patch|Delete|Put)'
```

### Autenticación

Ejemplo de inicio de sesión:

```http
POST {{baseUrl}}/auth/iniciar-sesion
Content-Type: application/json
```

```json
{
  "correo": "usuario@correo.com",
  "contrasena": "TuContrasena123"
}
```

Guarda el token devuelto y envíalo en las rutas protegidas:

```http
Authorization: Bearer {{token}}
```

### Movimientos

Prueba como mínimo:

- Crear un ingreso.
- Crear un gasto.
- Rechazar un monto incorrecto.
- Rechazar una categoría incompatible.
- Listar movimientos propios.
- Filtrar por tipo, categoría y fechas.
- Actualizar un movimiento propio.
- Eliminarlo lógicamente.
- Intentar consultar información de otro usuario.

Ejemplo conceptual:

```json
{
  "tipo": "GASTO",
  "monto": 25.5,
  "descripcion": "Compra de alimentos",
  "categoriaId": 2,
  "fecha": "2026-08-13"
}
```

### Presupuestos

Prueba:

- Crear un presupuesto de gasto para el mes actual o futuro.
- Rechazar una categoría de ingreso.
- Rechazar un periodo pasado cuando la regla lo prohíba.
- Rechazar un presupuesto duplicado.
- Comprobar alertas al acercarse al límite.

### Metas y aportes

Prueba:

- Crear una meta con nombre, monto y fecha objetivo.
- Registrar varios aportes.
- Comprobar el total ahorrado.
- Verificar el monto restante.
- Completar o desactivar una meta según las reglas del módulo.

### Reportes

Prueba reportes:

- Semanales.
- Mensuales.
- Anuales.
- Con ingresos y gastos conocidos para verificar resultados.
- Exportación PDF.
- Exportación Excel.

En las descargas de Postman utiliza `Send and Download`.

### Asistente con Gemini

Con `GEMINI_API_KEY` configurada, prueba preguntas como:

```text
¿Cuánto gasté este mes?
```

```text
¿Cuál es la categoría en la que más gasté?
```

```text
¿Cómo avanza mi meta Comprar una laptop?
```

El asistente debe respetar los datos del usuario autenticado y no debe inventar
movimientos que no existen.

## Pruebas del módulo de facturación

Estas son las rutas confirmadas del módulo:

### Perfil tributario

| Método | Ruta | Función |
| --- | --- | --- |
| `POST` | `/facturacion/perfil-tributario` | Crear el perfil |
| `GET` | `/facturacion/perfil-tributario` | Consultar el perfil propio |
| `PATCH` | `/facturacion/perfil-tributario` | Actualizar el perfil |

Si ya existen registros en `perfiles_tributarios`, ejecuta primero `GET`. Si el
usuario ya tiene un perfil, actualízalo mediante `PATCH` en lugar de crear otro.

Ejemplo:

```json
{
  "ruc": "RUC_VALIDO_DEL_CONTRIBUYENTE",
  "razonSocial": "Nombre del contribuyente",
  "nombreComercial": "Nombre comercial",
  "direccionMatriz": "Quito, Ecuador",
  "tipoContribuyente": "PERSONA_NATURAL",
  "regimenTributario": "GENERAL",
  "obligadoContabilidad": false,
  "establecimiento": "001",
  "puntoEmision": "001",
  "ambienteSri": "PRUEBAS"
}
```

### Firma electrónica

| Método | Ruta | Función |
| --- | --- | --- |
| `PUT` | `/facturacion/firma-electronica` | Cargar o reemplazar la firma |
| `GET` | `/facturacion/firma-electronica` | Consultar metadatos |
| `DELETE` | `/facturacion/firma-electronica` | Eliminar o desactivar la firma |

Para cargarla utiliza `Body → form-data`:

| Campo | Tipo | Contenido |
| --- | --- | --- |
| `archivo` | File | Archivo `.p12` o `.pfx` |
| `contrasena` | Text | Contraseña del certificado |

La contraseña del certificado no es la contraseña de SRI en Línea. Es la clave
que protege el archivo de firma.

### Clientes

| Método | Ruta | Función |
| --- | --- | --- |
| `POST` | `/facturacion/clientes` | Crear cliente |
| `GET` | `/facturacion/clientes` | Listar clientes |
| `GET` | `/facturacion/clientes/:id` | Obtener cliente |
| `PATCH` | `/facturacion/clientes/:id` | Actualizar cliente |
| `DELETE` | `/facturacion/clientes/:id` | Desactivar cliente |

Ejemplo:

```json
{
  "tipoIdentificacion": "CEDULA",
  "identificacion": "IDENTIFICACION_VALIDA",
  "razonSocial": "Cliente de prueba",
  "correo": "cliente@correo.com",
  "direccion": "Quito",
  "telefono": "0999999999"
}
```

### Productos y servicios

| Método | Ruta | Función |
| --- | --- | --- |
| `POST` | `/facturacion/productos-servicios` | Crear producto o servicio |
| `GET` | `/facturacion/productos-servicios` | Listar registros |
| `GET` | `/facturacion/productos-servicios/:id` | Obtener un registro |
| `PATCH` | `/facturacion/productos-servicios/:id` | Actualizarlo |
| `DELETE` | `/facturacion/productos-servicios/:id` | Desactivarlo |

Ejemplo:

```json
{
  "codigoPrincipal": "SERV-001",
  "descripcion": "Servicio de desarrollo",
  "precioUnitario": 100,
  "tarifaIva": "QUINCE"
}
```

Las tarifas iniciales son `CERO` y `QUINCE`.

### Categorías tributarias

| Método | Ruta | Función |
| --- | --- | --- |
| `PUT` | `/facturacion/configuracion-categorias` | Crear o actualizar una configuración |
| `GET` | `/facturacion/configuracion-categorias` | Consultar configuraciones |

Ejemplo de gasto personal:

```json
{
  "categoriaId": 3,
  "tratamiento": "GASTO_PERSONAL",
  "categoriaGastoPersonal": "SALUD"
}
```

Tratamientos disponibles:

```text
INGRESO_GRAVADO
INGRESO_EXENTO
COSTO_GASTO_DEDUCIBLE
GASTO_PERSONAL
NO_DEDUCIBLE
IGNORAR
```

Categorías de gastos personales:

```text
VIVIENDA
ALIMENTACION
SALUD
EDUCACION_ARTE_CULTURA
VESTIMENTA
TURISMO
```

### Facturas

| Método | Ruta | Función |
| --- | --- | --- |
| `POST` | `/facturacion/facturas` | Crear un borrador |
| `GET` | `/facturacion/facturas` | Listar y filtrar facturas |
| `GET` | `/facturacion/facturas/:id` | Consultar una factura |
| `PATCH` | `/facturacion/facturas/:id` | Actualizar un borrador |
| `DELETE` | `/facturacion/facturas/:id` | Anular localmente |
| `POST` | `/facturacion/facturas/:id/emitir` | Generar, firmar y enviar |
| `POST` | `/facturacion/facturas/:id/consultar-sri` | Consultar autorización |
| `POST` | `/facturacion/facturas/:id/reenviar-sri` | Reintentar el envío |
| `GET` | `/facturacion/facturas/:id/xml` | Descargar XML |
| `GET` | `/facturacion/facturas/:id/ride` | Descargar RIDE |

Ejemplo de borrador:

```json
{
  "clienteId": 1,
  "fechaEmision": "2026-08-13",
  "formaPago": "20",
  "observacion": "Factura creada desde Postman",
  "detalles": [
    {
      "productoServicioId": 1,
      "cantidad": 2,
      "descuento": 10
    }
  ]
}
```

Para un producto de USD 100, cantidad 2 y descuento de USD 10:

```text
Subtotal original: 200.00
Descuento: 10.00
Base imponible: 190.00
IVA 15 %: 28.50
Total: 218.50
```

El backend debe calcular estos valores. El frontend no debe decidir el IVA ni el
total final.

### Retenciones recibidas

| Método | Ruta | Función |
| --- | --- | --- |
| `POST` | `/facturacion/retenciones-recibidas` | Registrar retención |
| `GET` | `/facturacion/retenciones-recibidas` | Listar retenciones |
| `DELETE` | `/facturacion/retenciones-recibidas/:id` | Desactivar retención |

Ejemplo:

```json
{
  "tipo": "RENTA",
  "emisorIdentificacion": "RUC_VALIDO_DEL_CLIENTE",
  "numeroComprobante": "001-001-000000123",
  "fechaEmision": "2026-08-13",
  "baseImponible": 100,
  "porcentaje": 2,
  "valor": 2,
  "facturaId": 1,
  "observacion": "Retención recibida"
}
```

### Resumen tributario e impuesto a la renta

| Método | Ruta | Función |
| --- | --- | --- |
| `GET` | `/facturacion/resumen-tributario/:anio` | Resumen anual |
| `POST` | `/facturacion/impuesto-renta/:anio/calcular` | Estimación del impuesto |

El cálculo debe considerarse informativo. No reemplaza una declaración ni el
criterio de un profesional tributario.

### Orden recomendado para probar facturación

1. Iniciar sesión.
2. Consultar o crear perfil tributario.
3. Crear cliente.
4. Crear producto o servicio.
5. Configurar categorías tributarias.
6. Crear movimientos conocidos.
7. Crear una factura en borrador.
8. Verificar sus cálculos.
9. Actualizar el borrador.
10. Registrar una retención.
11. Consultar el resumen tributario.
12. Calcular la estimación de renta.
13. Cargar la firma electrónica.
14. Emitir en ambiente de pruebas.
15. Consultar el SRI.
16. Descargar XML y RIDE.

Sin RUC ni firma electrónica reales se pueden ejecutar los pasos locales, pero no
se puede completar una autorización real del SRI.

## Integración con el SRI

El módulo dispone del flujo necesario para:

1. Crear una factura en borrador.
2. Asignar secuencial.
3. Generar clave de acceso.
4. Construir XML.
5. Firmar el documento.
6. Enviarlo para recepción.
7. Consultar autorización.
8. Guardar XML, mensajes y autorización.
9. Generar el RIDE.

Estados contemplados:

```text
BORRADOR
FIRMADA
RECIBIDA
AUTORIZADA
DEVUELTA
NO_AUTORIZADA
ANULADA_LOCAL
ERROR
```

### Qué se necesita para una prueba real

- RUC real y activo.
- Firma electrónica vigente en formato `.p12` o `.pfx`.
- Contraseña del certificado.
- Correspondencia entre titular de la firma y contribuyente.
- Habilitación para comprobantes electrónicos.
- Ambiente `PRUEBAS`.
- Acceso a Internet.
- Servicios web del SRI disponibles.

El ambiente de pruebas no otorga validez tributaria a los comprobantes. Un RUC
inventado o un certificado autofirmado pueden servir para validaciones locales,
pero normalmente serán rechazados por el SRI.

La implementación no debe considerarse certificada hasta obtener una respuesta
real del ambiente de pruebas.

Información oficial:

- [Facturación electrónica del SRI](https://www.sri.gob.ec/facturacion-electronica)
- [Facturador SRI](https://www.sri.gob.ec/facturador-sri)

## Firma electrónica

Una firma electrónica permite identificar al emisor y garantizar que el XML no fue
modificado después de firmarse.

El backend debe:

1. Recibir el certificado y su contraseña.
2. Validar el archivo y vigencia.
3. Extraer los datos necesarios.
4. Cifrar la credencial antes de guardarla.
5. Descartar la contraseña.
6. Descifrar temporalmente la firma solamente durante la emisión.

Los archivos de firma nunca deben subirse a GitHub:

```gitignore
*.p12
*.pfx
*.pem
```

Un certificado autofirmado puede utilizarse para pruebas criptográficas locales,
pero no reemplaza una firma emitida por una entidad autorizada.

## Integración con Gemini

El backend se comunica con Gemini utilizando una API key configurada en `.env`.

El flujo esperado es:

1. El usuario envía un mensaje.
2. El backend identifica al usuario mediante su token.
3. Consulta solamente los datos financieros permitidos.
4. Construye el contexto necesario.
5. Envía una solicitud a Gemini.
6. Guarda la conversación y devuelve la respuesta.

La API key debe permanecer en el backend. El frontend nunca debe recibirla.

## Integración con el frontend

El frontend puede comenzar la integración cuando se cumplan estas condiciones:

```bash
npx prisma validate
npx prisma migrate status
npm run build
npm run lint
```

Además, las rutas principales deben responder correctamente en Postman.

### Contrato que necesita el frontend

Para cada endpoint se debe compartir:

- Método HTTP.
- Ruta.
- Autenticación requerida.
- Parámetros.
- Cuerpo de la petición.
- Respuesta exitosa.
- Errores posibles.

### Token en Angular

Después del inicio de sesión, Angular debe incluir:

```http
Authorization: Bearer TOKEN_DEL_USUARIO
```

Lo recomendable es utilizar un interceptor HTTP.

### CORS

El backend debe permitir únicamente los orígenes utilizados por el frontend:

```ts
app.enableCors({
  origin: ['http://localhost:4200'],
  credentials: true,
});
```

Ajusta el origen al puerto real del proyecto Angular.

## Estructura del proyecto

La estructura general puede verse así:

```text
fintech-backend/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── asistente-ia/
│   ├── auth/
│   ├── categorias/
│   ├── facturacion/
│   │   ├── dto/
│   │   ├── interfaces/
│   │   ├── pruebas/
│   │   ├── utilidades/
│   │   ├── controllers...
│   │   ├── services...
│   │   └── facturacion.module.ts
│   ├── metas-ahorro/
│   ├── movimientos/
│   ├── notificaciones/
│   ├── presupuestos/
│   ├── prisma/
│   ├── reportes/
│   ├── usuarios/
│   ├── app.module.ts
│   └── main.ts
├── test/
├── .env
├── .gitignore
├── package.json
├── prisma.config.ts
├── tsconfig.json
└── README.md
```

## Seguridad

El proyecto debe mantener estas reglas:

- Contraseñas con hash, nunca en texto plano.
- JWT firmado con un secreto seguro.
- Todas las consultas filtradas por el usuario autenticado.
- Validación de propiedad antes de consultar, actualizar o eliminar registros.
- Firma electrónica cifrada con un algoritmo autenticado como AES-256-GCM.
- Contraseña de firma utilizada temporalmente y no almacenada.
- API keys solamente en variables de entorno.
- Validación global de DTO.
- Totales tributarios calculados por el backend.
- Restricción de cambios en facturas firmadas o autorizadas.
- Registro de mensajes y errores enviados por el SRI.

Pruebas mínimas de seguridad:

- Solicitud sin token: `401`.
- Token alterado: `401`.
- Recurso inexistente: `404`.
- Recurso de otro usuario: `403` o `404`.
- Datos inválidos: `400`.
- Registro duplicado: `409` cuando corresponda.

## Comandos útiles

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run start:dev

# Compilar
npm run build

# Revisar ESLint
npm run lint

# Formatear y validar Prisma
npx prisma format
npx prisma validate

# Estado de migraciones
npx prisma migrate status

# Aplicar migraciones
npx prisma migrate dev

# Generar Prisma Client
npx prisma generate

# Abrir Prisma Studio
npx prisma studio

# Pruebas unitarias
npm run test

# Pruebas e2e
npm run test:e2e

# Cobertura
npm run test:cov
```

## Problemas frecuentes

### Prisma no encuentra el esquema

Ejecuta los comandos desde la carpeta que contiene `package.json` y `prisma/`:

```powershell
cd C:\Users\LENOVO\Desktop\Fintech\fintech-backend
npx prisma validate
```

### El backend compila, pero VS Code muestra errores

1. Guarda todos los archivos.
2. Ejecuta `npm run build`.
3. Ejecuta `npm run lint`.
4. Reinicia el servidor de TypeScript desde la paleta de VS Code.

### Prisma Client no reconoce campos nuevos

```bash
npx prisma generate
npm run build
```

### PostgreSQL no conecta

Comprueba:

- Servicio de PostgreSQL iniciado.
- Puerto correcto (`5433` en el entorno original).
- Usuario y contraseña.
- Existencia de `fintech_db`.
- Valor de `DATABASE_URL`.

### Una ruta responde `401`

Verifica el encabezado:

```http
Authorization: Bearer {{token}}
```

### No se puede emitir al SRI

Revisa:

- Perfil en ambiente `PRUEBAS`.
- RUC real.
- Firma vigente.
- Contraseña correcta.
- Coincidencia entre firma y contribuyente.
- Estado de la factura.
- Mensajes guardados en `mensajesSri`.
- Conectividad con los servicios del SRI.

## Alcance y limitaciones

El sistema puede considerarse completo como MVP académico porque cubre el control
financiero, análisis, reportes, asistencia con IA y flujo principal de factura
electrónica.

Antes de producción todavía se requiere:

- Ejecutar todas las migraciones finales.
- Pasar `build`, `lint` y pruebas automatizadas.
- Probar aislamiento entre usuarios.
- Validar el frontend completo.
- Obtener una autorización real en el ambiente de pruebas del SRI.
- Revisar anualmente tarifas y reglas tributarias.
- Configurar secretos mediante un gestor seguro.
- Incorporar monitoreo, copias de seguridad y recuperación.
- Definir despliegue HTTPS.

Actualmente el alcance de comprobantes se concentra en facturas. Notas de crédito,
notas de débito, guías de remisión, liquidaciones y emisión de comprobantes de
retención pueden incorporarse en futuras versiones si el proyecto lo requiere.

## Licencia

Este proyecto fue desarrollado con fines académicos. La licencia definitiva debe
ser definida por el equipo antes de publicar o distribuir el software.

NestJS se distribuye bajo licencia MIT. Consulta su
[repositorio oficial](https://github.com/nestjs/nest) para más información.
