import { resetTestDatabase } from './test-database.js';

const target = await resetTestDatabase();
console.log(`Reset, migrated, and seeded ${new URL(target).pathname.slice(1)}`);
