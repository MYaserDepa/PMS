import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const backendDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(backendDirectory, '..', '.env'), quiet: true });
