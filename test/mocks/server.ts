import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW Server for Node.js (Vitest) environment
 *
 * This server intercepts HTTP requests during tests and returns mock responses.
 * Start this server in test/setup.ts before running tests.
 *
 * Usage in tests:
 * - Handlers defined in handlers.ts are applied by default
 * - Override handlers for specific tests using server.use()
 * - Reset to default handlers using server.resetHandlers()
 *
 * @example
 * // Override a handler in a specific test
 * import { server } from './mocks/server';
 * import { http, HttpResponse } from 'msw';
 *
 * it('should handle API error', async () => {
 *   server.use(
 *     http.get('/api/patients', () => {
 *       return new HttpResponse(null, { status: 500 });
 *     })
 *   );
 *   // Test error handling...
 * });
 */
export const server = setupServer(...handlers);
