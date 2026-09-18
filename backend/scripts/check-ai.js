// Explicit administrator diagnostic. Never runs at startup or sends health data.
import { pathToFileURL } from 'node:url';

export async function checkAiConfiguration(config, request = fetch) {
  const report = { ok: false, mode: config.mockMode ? 'demo' : 'live', model: config.model, checks: [] };
  if (!config.apiKey) {
    report.checks.push({ check: 'configuration', code: 'AI_NOT_CONFIGURED' });
    return report;
  }
  if (config.mockMode) {
    report.checks.push({ check: 'configuration', code: 'AI_DEMO_ENABLED' });
    return report;
  }
  // Send credentials only to DeepSeek's documented production endpoint.
  if (!['https://api.deepseek.com', 'https://api.deepseek.com/v1'].includes(config.baseUrl)) {
    report.checks.push({ check: 'configuration', code: 'AI_UNEXPECTED_ENDPOINT' });
    return report;
  }
  for (const path of ['/models', '/user/balance']) {
    try {
      const response = await request(`${config.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${config.apiKey}` }, signal: AbortSignal.timeout(20000), redirect: 'error'
      });
      const check = { check: path === '/models' ? 'model' : 'balance', status: response.status };
      report.checks.push(check);
      if (!response.ok) {
        check.code = response.status === 401 || response.status === 403 ? 'AI_PROVIDER_AUTH'
          : response.status === 402 ? 'AI_PROVIDER_BALANCE' : 'AI_PROVIDER_FAILED';
        return report;
      }
      const body = await response.json();
      if (path === '/models') {
        check.available = Array.isArray(body.data) && body.data.some((item) => item.id === config.model);
        if (!check.available) { check.code = 'AI_PROVIDER_MODEL'; return report; }
      } else {
        check.available = body.is_available === true;
        if (!check.available) { check.code = 'AI_PROVIDER_BALANCE'; return report; }
      }
    } catch (error) {
      report.checks.push({ check: 'connection', code: ['TimeoutError', 'AbortError'].includes(error?.name) ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_CONNECTION' });
      return report;
    }
  }
  report.ok = true;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--production')) process.env.DOTENV_CONFIG_PATH = '.env.production';
  const { env } = await import('../src/config/env.js');
  const report = await checkAiConfiguration(env.ai);
  console.log(JSON.stringify(report, null, 2));
  console.log('Comprueba configuración, modelo y saldo. No genera respuestas ni consume cupos de usuarios.');
  if (!report.ok) process.exitCode = 1;
}
