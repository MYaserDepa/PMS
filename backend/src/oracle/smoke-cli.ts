import '../env.js';
import { parseConfig } from '../config.js';
import { OracleClient } from './client.js';

const config = parseConfig(process.env);
const client = new OracleClient(config);
const employees = await client.listEmployees();
const heads = await client.listDepartmentHeads();
const employers = await client.listEmployerMappings();
console.log(`Oracle smoke passed: ${employees.length} eligible employees, ${heads.length} Department Head records, ${employers.length} employer mappings`);
