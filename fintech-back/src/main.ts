// ValidationPipe permite validar globalmente los datos recibidos.
import { ValidationPipe } from '@nestjs/common';

// NestFactory permite crear e iniciar la aplicación NestJS.
import { NestFactory } from '@nestjs/core';

// Herramientas utilizadas para generar la documentación Swagger.
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Módulo principal del backend.
import { AppModule } from './app.module';

// Función principal encargada de iniciar la aplicación.
async function bootstrap() {
  // Asegura la zona horaria oficial de Ecuador (America/Guayaquil, UTC-5)
  process.env.TZ = 'America/Guayaquil';

  // Creamos la aplicación utilizando AppModule.
  const app = await NestFactory.create(AppModule);

  // Todos los endpoints comenzarán con /api.
  app.setGlobalPrefix('api');

  // Habilita CORS para que el frontend Angular (fintech-frond) pueda
  // consumir la API desde otro origen/puerto durante el desarrollo.
  //
  // La autenticación de esta app usa un token JWT enviado a mano en el
  // header "Authorization" (ver interceptors/auth-interceptor.ts), NO
  // cookies. Por eso no se necesita "credentials: true" ni una lista
  // cerrada de orígenes: basta con reflejar el origen que pida el
  // navegador, lo que evita cualquier problema de comparación de strings
  // (mayúsculas, espacios, IP vs. localhost, etc.) que pueda bloquear
  // silenciosamente el registro/login.
  app.enableCors({
    origin: true,
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  //Este bloque activa la validación automática de los datos recibidos en los endpoints del backend.//
  // Aplicamos la validación a todos los endpoints del backend.
  app.useGlobalPipes(
    new ValidationPipe({
      // Solo permite propiedades definidas en los DTO.
      whitelist: true,

      // Rechaza la petición si contiene propiedades no permitidas.
      forbidNonWhitelisted: true,

      // Transforma los datos recibidos al tipo definido en el DTO.
      transform: true,
    }),
  );

  // Configuración general de Swagger.
  const configuracionSwagger = new DocumentBuilder()
    .setTitle('API FinTech')
    .setDescription(
      'Documentación de los endpoints del backend de la aplicación FinTech',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Pega únicamente el accessToken obtenido al iniciar sesión',
      },
      'access-token',
    )
    .build();

  // Swagger examina los controladores y genera la documentación.
  const documentoSwagger = SwaggerModule.createDocument(
    app,
    configuracionSwagger,
  );

  // Publicamos Swagger en /api/docs.
  SwaggerModule.setup('api/docs', app, documentoSwagger);

  // Utilizamos PORT si está configurado; de lo contrario, usamos 3000.
  const puerto = process.env.PORT ?? 3000;

  // Encendemos el servidor.
  await app.listen(puerto);
}

// Iniciamos la aplicación.
// void indica que ejecutamos esta función asíncrona sin guardar su resultado.
void bootstrap();
