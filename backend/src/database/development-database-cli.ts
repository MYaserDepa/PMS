import '../env.js';
import { developmentDatabaseName, resetDevelopmentDatabase } from './development-database.js';
import { resetTestDatabase } from './test-database.js';

const scope = process.argv[2];
if (scope !== 'development' && scope !== 'all') {
  throw new Error('Usage: development-database-cli.ts development|all');
}

const developmentName = developmentDatabaseName(process.env);
console.log(`Resetting local development database ${developmentName}`);
await resetDevelopmentDatabase();
console.log(`Reset, migrated, and seeded ${developmentName}`);

if (scope === 'all') {
  const target = await resetTestDatabase();
  console.log(`Reset, migrated, and seeded ${new URL(target).pathname.slice(1)}`);
}
