import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from './config/env.js';
import { registerExceptionHandler } from './errors/exception-handler.js';
import { SessionRepository } from './repositories/session-repository.js';
import { AttendanceService } from './services/attendance-service.js';
import { WhatsAppClient } from './services/whatsapp-client.js';
import { registerWebhookRoutes } from './routes/webhook.js';

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const repository = new SessionRepository(config);
  await repository.initialize();

  const attendance = new AttendanceService(
    config.attendance,
    repository,
    new WhatsAppClient(config),
  );
  const app = Fastify({ logger: { level: config.logLevel } });

  const cleanupTimer = setInterval(() => {
    void attendance
      .cleanup()
      .catch((error: unknown) => app.log.error({ err: error }, 'Falha na limpeza das sessões'));
  }, config.cleanupIntervalMs);
  cleanupTimer.unref();

  registerExceptionHandler(app);
  registerWebhookRoutes(app, config, attendance);
  app.addHook('onClose', async () => {
    clearInterval(cleanupTimer);
    await attendance.drain();
  });

  return app;
}
