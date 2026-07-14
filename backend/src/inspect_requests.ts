import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestsService } from './requests/requests.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(RequestsService);
  const reqs = await service.findAllRequests({});
  console.log('--- SOLICITUDES RETORNADAS POR EL BACKEND ---');
  if (reqs.length > 0) {
    console.log(JSON.stringify(reqs[0], null, 2));
  } else {
    console.log('No se encontraron solicitudes.');
  }
  await app.close();
}
bootstrap();
