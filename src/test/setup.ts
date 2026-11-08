// Deterministic env for unit/integration tests. Never use real secrets here.
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.AUTH_SECRET ??= "test-auth-secret-test-auth-secret-0000";
process.env.TOKEN_PEPPER ??= "test-token-pepper-test-token-pepper-0000";
process.env.ADMIN_EMAILS ??= "admin@example.com";
process.env.MCP_RATE_LIMIT_PER_MINUTE ??= "5";
