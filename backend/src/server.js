import { app } from './app.js';
import { env, validateProductionSecrets } from './config/env.js';
import { db, pingDb } from './config/db.js';
import { startMedicationScheduler } from './services/medication-service.js';
import { log, logError } from './utils/logger.js';

validateProductionSecrets();

let shuttingDown = false;
async function stop(reason, error, exitCode = 1) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (error) logError(reason, error);
  else log('info', reason);
  try { await db.end(); } catch (closeError) { logError('database_pool_close_failed', closeError); }
  process.exit(exitCode);
}
process.on('uncaughtException', (error) => { void stop('uncaught_exception', error); });
process.on('unhandledRejection', (reason) => { void stop('unhandled_rejection', reason); });

try {
  await pingDb();
  log('info', 'database_connected');
} catch (error) {
  await stop('database_startup_failed', error);
}

const server = app.listen(env.port, '0.0.0.0', () => {
  log('info', 'api_listening', { port: env.port });
  startMedicationScheduler();
});
server.on('error', (error) => { void stop('http_server_failed', error); });
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    log('info', 'shutdown_requested', { signal });
    server.close(() => { void stop('http_server_stopped', null, 0); });
  });
}
