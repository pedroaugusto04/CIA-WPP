import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config/env.js';
import { HttpStatus } from '../constants/http.js';
import { WEBHOOK_SUBSCRIPTION_MODE, WebhookQuery, WebhookResponse } from '../constants/whatsapp.js';
import type { AttendanceService } from '../services/attendance-service.js';
import { extractHumanReplyEchoes, extractMessages } from '../services/webhook-parser.js';

type VerificationQuery = Partial<Record<(typeof WebhookQuery)[keyof typeof WebhookQuery], string>>;

export function registerWebhookRoutes(
  app: FastifyInstance,
  config: AppConfig,
  attendance: AttendanceService,
): void {
  for (const path of config.webhookPaths) {
    app.get<{ Querystring: VerificationQuery }>(path, (request, reply) => {
      const mode = request.query[WebhookQuery.MODE];
      const token = request.query[WebhookQuery.VERIFY_TOKEN];
      const challenge = request.query[WebhookQuery.CHALLENGE];

      if (mode === WEBHOOK_SUBSCRIPTION_MODE && token === config.verifyToken && challenge) {
        return reply.code(HttpStatus.OK).send(challenge);
      }

      return reply.code(HttpStatus.FORBIDDEN).send(WebhookResponse.FORBIDDEN);
    });

    app.post<{ Body: unknown }>(path, async (request, reply) => {
      for (const echo of extractHumanReplyEchoes(request.body, config.phoneNumberId)) {
        await attendance.processHumanReply(echo);
      }

      for (const message of extractMessages(request.body, config.phoneNumberId)) {
        await attendance.process(message);
      }

      return reply.code(HttpStatus.OK).send(WebhookResponse.RECEIVED);
    });
  }
}
