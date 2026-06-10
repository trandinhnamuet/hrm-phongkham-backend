import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const allowedOrigins = [
    'http://localhost:3000',
    'https://hrm-nhakhoagiadinh.vercel.app',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('HRM Phòng Khám API')
    .setDescription('API cho hệ thống HRM phòng khám nha khoa')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}/api`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
