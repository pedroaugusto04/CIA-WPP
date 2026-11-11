import { SHUTDOWN_SIGNALS } from './src/constants/runtime.js';
import { buildApp } from './src/app.js';
import { loadConfig } from './src/config/env.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const app = await buildApp(config);

  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => {
      void app.close().catch((error: unknown) => {
        app.log.error(error);
        process.exitCode = 1;
      });
    });
  }

  await app.listen({ port: config.port, host: config.host });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
