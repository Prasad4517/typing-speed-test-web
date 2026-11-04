import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const environment = process.env.NODE_ENV || 'development';

if (environment === 'development') {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  dotenv.config({
    path: resolve(currentDirectory, '../../.env.development'),
    quiet: true,
  });
}
