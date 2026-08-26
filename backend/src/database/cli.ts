import { closePool } from './pool.js';
import { migrateDown, migrateUp } from './migrate.js';

const direction = process.argv[2];
try {
  if (direction === 'up') {
    const applied = await migrateUp();
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is current');
  } else if (direction === 'down') {
    const reverted = await migrateDown();
    console.log(reverted ? `Reverted: ${reverted}` : 'No migration to revert');
  } else {
    throw new Error('Usage: cli.ts up|down');
  }
} finally {
  await closePool();
}
