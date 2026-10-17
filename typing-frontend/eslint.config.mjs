import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const directory = dirname(filename);
const compat = new FlatCompat({ baseDirectory: directory });

const eslintConfig = [
  { ignores: ['.next/**', 'node_modules/**', 'out/**', 'coverage/**'] },
  ...compat.extends('next/core-web-vitals'),
];

export default eslintConfig;
