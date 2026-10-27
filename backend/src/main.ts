import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Serve static files with automatic PostgreSQL rehydration when disk is reset (Render ephemeral containers)
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  app.use('/uploads', async (req: any, res: any, next: any) => {
    const requestedPath = path.join(uploadsDir, req.path);
    if (fs.existsSync(requestedPath)) {
      return next();
    }

    const fileName = path.basename(req.path);
    if (!fileName) return next();

    try {
      const prisma = app.get(PrismaService);
      const rows: any = await prisma.$queryRawUnsafe(
        'SELECT mime_type, data FROM product_media_files WHERE file_name = $1 LIMIT 1',
        fileName,
      );

      if (rows && rows.length > 0) {
        const fileRow = rows[0];
        const dir = path.dirname(requestedPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(requestedPath, fileRow.data);

        res.setHeader('Content-Type', fileRow.mime_type || 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(fileRow.data);
      }
    } catch (err) {
      console.warn('Falha ao restaurar mídia do banco:', err);
    }

    next();
  });

  app.use('/uploads', express.static(uploadsDir, { maxAge: '30d' }));

  // Increase payload limit for file transfers
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const allowedOriginsRegex = /^(https?:\/\/([a-zA-Z0-9-]+\.)*vercel\.app|https?:\/\/([a-zA-Z0-9-]+\.)*eusou\.com(\.br)?|http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?)$/;

  app.enableCors({
    origin: (origin, callback) => {
      const frontendUrl = process.env.FRONTEND_URL;
      if (!origin || allowedOriginsRegex.test(origin) || (frontendUrl && origin === frontendUrl)) {
        callback(null, true);
      } else {
        callback(new Error('Origem de requisição não permitida pelas políticas de CORS do EuSou.'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}`);
}
bootstrap();
