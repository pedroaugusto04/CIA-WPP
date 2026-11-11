import type { FastifyInstance } from 'fastify';
import { HttpStatus } from '../constants/http.js';
import { WebhookResponse } from '../constants/whatsapp.js';
import { isRecord } from '../utils/validation.js';

/** Não expõe detalhes internos e permite nova tentativa quando o processamento falha. */
export function registerExceptionHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Falha no processamento da requisição');

    if (
      isRecord(error) &&
      typeof error.statusCode === 'number' &&
      error.statusCode >= HttpStatus.BAD_REQUEST &&
      error.statusCode < HttpStatus.INTERNAL_SERVER_ERROR
    ) {
      return reply.code(error.statusCode).send(WebhookResponse.INVALID_REQUEST);
    }

    return reply.code(HttpStatus.SERVICE_UNAVAILABLE).send(WebhookResponse.PROCESSING_FAILED);
  });
}
