import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import * as express from 'express';
import type { Request, Response, NextFunction } from 'express';

// Set process timezone to UTC to ensure correct database date parsing
process.env.TZ = 'UTC';

async function bootstrap() { 
  const app = await NestFactory.create(AppModule);

  // Increase payload limit for bulk uploads and multimodal certificate processing
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Enable CORS
  const allowedOrigins = [
    'https://gaugemaster.iviewsense.com',
    'https://atindia.iviewsense.com',
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow same-origin, curl, server-to-server requests with no origin header
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });

  // Serve frontend static files
  app.use(express.static(join(__dirname, 'public')));
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

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
