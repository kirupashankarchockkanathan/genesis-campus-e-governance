// Runs before every test file. Must set env BEFORE config is imported.
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456';
process.env.BCRYPT_COST = '4';
process.env.AUTO_VERIFY_EMAIL = 'false';
process.env.ALLOWED_EMAIL_DOMAINS = 'campus.example';
process.env.RATE_LIMIT_MAX = '100000';
process.env.WEB_URL = 'http://localhost:5173';
// Uploads go to a temporary folder (spec 15.1 rule 5).
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'ccp-test-uploads');
// Tests never call a real model; the chatbot uses its built-in fallback unless a test injects a client.
process.env.ANTHROPIC_API_KEY = '';
