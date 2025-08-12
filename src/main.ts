import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import * as express from 'express';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() { 
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:8080', '*'],
    credentials: true,
  });

  // Serve frontend static files
  app.use(express.static(join(__dirname, 'public')));

  // SPA fallback for non-API routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(join(__dirname, 'public', 'index.html'));
  });

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Instrument Tracker API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT || 3000);
}

bootstrap();
