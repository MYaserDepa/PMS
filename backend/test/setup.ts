import '../src/env.js';
import { resetTestDatabase, testDatabaseUrl } from '../src/database/test-database.js';

if (process.env.PMS_USE_TEST_DATABASE === 'true') {
  process.env.DATABASE_URL = testDatabaseUrl(process.env.DATABASE_URL);
}

if (process.env.PMS_RESET_TEST_DATABASE_PER_FILE === 'true') {
  await resetTestDatabase();
}
