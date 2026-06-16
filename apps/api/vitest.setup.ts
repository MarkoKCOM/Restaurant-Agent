// Provide the minimum env required by src/env.ts so unit tests can import
// modules that transitively load the db client without a real environment.
// The postgres-js client is lazy, so no connection is opened.
process.env.DATABASE_URL ||= "postgres://test:test@localhost:5432/test";
process.env.JWT_SECRET ||= "test-secret-key";
process.env.NODE_ENV ||= "test";
