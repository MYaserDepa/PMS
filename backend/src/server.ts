import './env.js';
import { createApp } from './app.js';
import { parseConfig } from './config.js';

const config = parseConfig(process.env);
const app = createApp(config);

app.listen(config.BACKEND_PORT, () => {
  console.log(`PMS backend listening on http://localhost:${config.BACKEND_PORT}`);
});
