import { describe, expect, it } from 'vitest';
import { developmentDatabaseName } from '../src/database/development-database.js';

const validEnvironment = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'development',
  PMS_ALLOW_DATABASE_RESET: 'true',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pms'
});

describe('development database reset guard', () => {
  it('accepts an opted-in local development database', () => {
    expect(developmentDatabaseName(validEnvironment())).toBe('pms');
    expect(
      developmentDatabaseName({
        ...validEnvironment(),
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/pms_dev'
      })
    ).toBe('pms_dev');
  });

  it('requires the development environment and explicit opt-in', () => {
    expect(() => developmentDatabaseName({ ...validEnvironment(), NODE_ENV: 'test' })).toThrow(/NODE_ENV/);
    expect(() => developmentDatabaseName({ ...validEnvironment(), PMS_ALLOW_DATABASE_RESET: 'false' })).toThrow(
      /PMS_ALLOW_DATABASE_RESET/
    );
  });

  it('rejects non-local hosts', () => {
    expect(() =>
      developmentDatabaseName({
        ...validEnvironment(),
        DATABASE_URL: 'postgresql://postgres:postgres@database.example.com:5432/pms'
      })
    ).toThrow(/non-local host/);
  });

  it.each(['postgres', 'template0', 'template1', 'pms_test'])(
    'rejects the protected database name %s',
    (databaseName) => {
      expect(() =>
        developmentDatabaseName({
          ...validEnvironment(),
          DATABASE_URL: `postgresql://postgres:postgres@localhost:5432/${databaseName}`
        })
      ).toThrow(/protected development database/);
    }
  );

  it('rejects missing, malformed, and non-PostgreSQL targets', () => {
    expect(() => developmentDatabaseName({ ...validEnvironment(), DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
    expect(() =>
      developmentDatabaseName({ ...validEnvironment(), DATABASE_URL: 'postgresql://localhost/pms-name' })
    ).toThrow(/unsafe database name/);
    expect(() =>
      developmentDatabaseName({ ...validEnvironment(), DATABASE_URL: 'https://localhost/pms' })
    ).toThrow(/postgresql protocol/);
  });
});
