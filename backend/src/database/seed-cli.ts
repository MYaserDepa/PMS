import { migrateUp } from './migrate.js';
import { closePool } from './pool.js';
import { seedDatabase } from './seed.js';

try {
  await migrateUp();
  await seedDatabase();
  console.log('Seeded PMS 2027 configuration');
} finally {
  await closePool();
}
