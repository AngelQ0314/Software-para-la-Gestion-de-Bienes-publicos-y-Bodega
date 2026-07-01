import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Validación global de DTOs con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,     
      forbidNonWhitelisted: true, 
      transform: true, 
    }),
  );

  // CORS: permite peticiones desde el frontend Angular
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true,
  });

  // Prefijo global de la API
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  const env = process.env.NODE_ENV ?? 'development';

  await app.listen(port);

  logger.log('--------------------------------------------------');
  logger.log('Sistema de Gestión de Bienes Públicos y Bodega');
  logger.log('--------------------------------------------------');
  logger.log(`Backend corriendo correctamente`);
  logger.log(`Entorno  : ${env.toUpperCase()}`);
  logger.log(`URL      : http://localhost:${port}/api`);
  logger.log(`Base de datos conectada`);
  logger.log('--------------------------------------------------');
}

bootstrap();
