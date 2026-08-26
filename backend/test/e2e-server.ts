import '../src/env.js';
import { createApp } from '../src/app.js';
import { parseConfig } from '../src/config.js';
import { createFixtureOracleClient } from './fixtures/oracle.js';

const config = parseConfig(process.env);
const app = createApp(config, { oracle: createFixtureOracleClient(config) });

app.listen(config.BACKEND_PORT, () => {
  console.log(`PMS browser-test backend listening on http://localhost:${config.BACKEND_PORT}`);
});
