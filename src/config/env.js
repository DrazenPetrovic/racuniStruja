import dotenv from 'dotenv';
dotenv.config();

for (const naziv of ['JWT_SECRET', 'APP_USERNAME', 'APP_PASSWORD_HASH']) {
  if (!process.env[naziv]) {
    throw new Error(`${naziv} nije postavljen u .env`);
  }
}

if (!/^[0-9a-f]{32}:[0-9a-f]{128}$/.test(process.env.APP_PASSWORD_HASH)) {
  throw new Error('APP_PASSWORD_HASH nije ispravan hash. Napravi ga komandom: npm run lozinka');
}

export const env = {
  PORT: process.env.PORT || 3010,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  APP_USERNAME: process.env.APP_USERNAME,
  APP_PASSWORD_HASH: process.env.APP_PASSWORD_HASH,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
};
