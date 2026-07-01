import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Bienvenido al sistema de gestion de bienes publicos y bodega';
  }
}
