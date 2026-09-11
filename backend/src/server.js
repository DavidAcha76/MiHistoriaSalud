import { app } from './app.js';
import { env, validateProductionSecrets } from './config/env.js';
import { pingDb } from './config/db.js';
import { startAiScheduler } from './services/ai-scheduler-service.js';

validateProductionSecrets();

try {
  await pingDb();
  console.log(`MySQL conectado: ${env.db.host}:${env.db.port}/${env.db.name}`);
} catch (error) {
  console.error('No se pudo conectar a MySQL. Ejecuta npm run db:setup y revisa .env.');
  console.error(error.message);
  process.exit(1);
}

app.listen(env.port, '0.0.0.0', () => {
  console.log(`Clinicsoft API escuchando en http://0.0.0.0:${env.port}`);
  startAiScheduler();
});
