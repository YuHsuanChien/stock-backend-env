import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://barry-cruz-shapes-poker.trycloudflare.com',
    ],
  });
  await app.listen(process.env.PORT ?? 3100, '0.0.0.0');
}
bootstrap();
