import type { AppConfig } from '../config/env.js';
import { HttpMethod, JSON_CONTENT_TYPE } from '../constants/http.js';
import {
  WHATSAPP_GRAPH_ORIGIN,
  WHATSAPP_PRODUCT,
  WHATSAPP_RECIPIENT_TYPE,
} from '../constants/whatsapp.js';
import { ApplicationError, ErrorCode } from '../errors/application-error.js';
import type { OutboundMessage, TextSender } from '../types/whatsapp.js';
import { isRecord } from '../utils/validation.js';

type ClientConfig = Pick<
  AppConfig,
  'accessToken' | 'graphVersion' | 'phoneNumberId' | 'requestTimeoutMs'
>;

export class WhatsAppClient implements TextSender {
  constructor(private readonly config: ClientConfig) {}

  async send(to: string, message: OutboundMessage): Promise<void> {
    try {
      const content =
        message.type === 'text'
          ? { type: 'text', text: { body: message.body } }
          : {
              type: 'interactive',
              interactive: {
                type: 'list',
                body: { text: message.body },
                action: {
                  button: message.button,
                  sections: [{ title: message.section, rows: message.rows }],
                },
              },
            };
      const response = await fetch(
        `${WHATSAPP_GRAPH_ORIGIN}/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`,
        {
          method: HttpMethod.POST,
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': JSON_CONTENT_TYPE,
          },
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
          body: JSON.stringify({
            messaging_product: WHATSAPP_PRODUCT,
            recipient_type: WHATSAPP_RECIPIENT_TYPE,
            to,
            ...content,
          }),
        },
      );

      const payload: unknown = await response.json();

      if (!response.ok) {
        const metaError = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
        const metaCode = typeof metaError?.code === 'number' ? `, código ${metaError.code}` : '';
        const detail = typeof metaError?.message === 'string' ? `: ${metaError.message}` : '';
        throw new ApplicationError(
          ErrorCode.META_REQUEST_FAILED,
          `Meta Graph API retornou HTTP ${response.status}${metaCode}${detail}.`,
        );
      }

      if (
        !isRecord(payload) ||
        !Array.isArray(payload.messages) ||
        !payload.messages.some(
          (message: unknown) =>
            isRecord(message) && typeof message.id === 'string' && message.id.length > 0,
        )
      ) {
        throw new ApplicationError(
          ErrorCode.META_REQUEST_FAILED,
          'Meta não confirmou o identificador da mensagem enviada.',
        );
      }
    } catch (cause) {
      if (cause instanceof ApplicationError) {
        throw cause;
      }

      throw new ApplicationError(
        ErrorCode.META_REQUEST_FAILED,
        'Falha na comunicação com a Meta Graph API.',
        { cause },
      );
    }
  }
}
