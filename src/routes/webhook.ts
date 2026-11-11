import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config/env.js';
import { HttpStatus } from '../constants/http.js';
import { WEBHOOK_SUBSCRIPTION_MODE, WebhookQuery, WebhookResponse } from '../constants/whatsapp.js';
import type { AttendanceService } from '../services/attendance-service.js';
import { extractHumanReplyEchoes, extractMessages } from '../services/webhook-parser.js';
import { isRecord } from '../utils/validation.js';

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
      if (config.logWebhookPayloadShape) {
        request.log.info({ payloadShape: payloadShape(request.body) }, 'Webhook payload shape');
      }

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

function payloadShape(value: unknown, depth = 0): unknown {
  if (value === null) return null;
  if (typeof value === 'string') return '<string>';
  if (typeof value === 'number') return '<number>';
  if (typeof value === 'boolean') return '<boolean>';
  if (Array.isArray(value)) {
    return { type: 'array', length: value.length, sample: depth < 7 ? value.slice(0, 2).map((item) => payloadShape(item, depth + 1)) : '<truncated>' };
  }
  if (isRecord(value)) {
    if (depth >= 7) return '<truncated>';
    return Object.fromEntries(
      Object.entries(value).slice(0, 40).map(([key, item]) => [key, payloadShape(item, depth + 1)]),
    );
  }
  return `<${typeof value}>`;
}
