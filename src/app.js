import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';

import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import racuniRoutes from './routes/racuni.routes.js';
import ocitanjaRoutes from './routes/ocitanja.routes.js';

const distPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

export const createApp = () => {
  const app = express();

  const allowedOrigins = [
    env.FRONTEND_URL,
    'https://localhost', // Capacitor Android
    'http://localhost:5173',
  ];

  app.use(cors({
    origin: (origin, callback) => {
      callback(null, !origin || allowedOrigins.includes(origin));
    },
  }));
  app.use(express.json());

  app.use('/api', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/racuni', racuniRoutes);
  app.use('/api/ocitanja', ocitanjaRoutes);

  app.use(express.static(distPath));

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ success: false, message: 'Fajl je prevelik (najviše 5 MB)' });
    }
    console.error('Neobradjena greska:', error);
    return res.status(error.status || 500).json({ success: false, message: 'Greška pri obradi zahtjeva' });
  });

  return app;
};
