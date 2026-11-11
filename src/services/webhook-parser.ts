import { DIGITS_ONLY_PATTERN } from '../constants/patterns.js';
import { WhatsAppField, WhatsAppMessageType } from '../constants/whatsapp.js';
import type { HumanReplyEcho, InboundMessage } from '../types/whatsapp.js';
import { isRecord } from '../utils/validation.js';

export function extractMessages(body: unknown, phoneNumberId: string): InboundMessage[] {
  const growhubMessage = extractGrowhubMessage(body, phoneNumberId);
  if (growhubMessage) return [growhubMessage];
  if (!isRecord(body) || !Array.isArray(body.entry)) return [];
  const result: InboundMessage[] = [];
  for (const entry of body.entry as unknown[]) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes as unknown[]) {
      if (!isRecord(change) || change.field !== WhatsAppField.MESSAGES || !isRecord(change.value))
        continue;
      const value = change.value;
      if (
        !isRecord(value.metadata) ||
        value.metadata.phone_number_id !== phoneNumberId ||
        !Array.isArray(value.messages)
      )
        continue;
      for (const message of value.messages as unknown[]) {
        if (!isRecord(message) || !isValidEnvelope(message)) continue;
        if (message.type === WhatsAppMessageType.REACTION) continue;
        result.push({
          from: message.from,
          id: message.id,
          content: messageContent(message),
        });
      }
    }
  }
  return result;
}

function extractGrowhubMessage(body: unknown, phoneNumberId: string): InboundMessage | undefined {
  if (
    !isRecord(body) ||
    typeof body.event !== 'string' ||
    body.phoneNumberId !== phoneNumberId ||
    typeof body.from !== 'string' ||
    !DIGITS_ONLY_PATTERN.test(body.from) ||
    typeof body.messageId !== 'string' ||
    body.messageId.length === 0 ||
    typeof body.type !== 'string' ||
    typeof body.content !== 'string' ||
    body.content.trim().length === 0
  ) {
    return undefined;
  }

  return {
    from: body.from,
    id: body.messageId,
    content: { type: 'text', text: body.content.trim() },
  };
}

export function extractHumanReplyEchoes(body: unknown, phoneNumberId: string): HumanReplyEcho[] {
  if (!isRecord(body) || !Array.isArray(body.entry)) return [];
  const echoes: HumanReplyEcho[] = [];
  for (const entry of body.entry as unknown[]) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes as unknown[]) {
      if (
        !isRecord(change) ||
        change.field !== WhatsAppField.SMB_MESSAGE_ECHOES ||
        !isRecord(change.value)
      )
        continue;
      const value = change.value;
      if (
        !isRecord(value.metadata) ||
        value.metadata.phone_number_id !== phoneNumberId ||
        !Array.isArray(value.messages)
      )
        continue;
      for (const message of value.messages as unknown[]) {
        if (
          isRecord(message) &&
          typeof message.to === 'string' &&
          DIGITS_ONLY_PATTERN.test(message.to) &&
          typeof message.id === 'string' &&
          message.id.length > 0
        ) {
          echoes.push({ to: message.to, id: message.id });
        }
      }
    }
  }
  return echoes;
}

function isValidEnvelope(
  message: Record<string, unknown>,
): message is Record<string, unknown> & { from: string; id: string; type: string } {
  return (
    typeof message.from === 'string' &&
    DIGITS_ONLY_PATTERN.test(message.from) &&
    typeof message.id === 'string' &&
    message.id.length > 0 &&
    typeof message.type === 'string'
  );
}

function messageContent(
  message: Record<string, unknown> & { type: string },
): InboundMessage['content'] {
  if (
    message.type === WhatsAppMessageType.TEXT &&
    isRecord(message.text) &&
    typeof message.text.body === 'string'
  ) {
    return { type: 'text', text: message.text.body.trim() };
  }

  if (message.type === WhatsAppMessageType.INTERACTIVE && isRecord(message.interactive)) {
    const id = selectedReply(message.interactive);
    if (id) return { type: 'selection', id };
  }

  return { type: 'unsupported', messageType: message.type };
}

function selectedReply(interactive: Record<string, unknown>): string | undefined {
  if (
    interactive.type === 'list_reply' &&
    isRecord(interactive.list_reply) &&
    typeof interactive.list_reply.id === 'string'
  )
    return interactive.list_reply.id;
  if (
    interactive.type === 'button_reply' &&
    isRecord(interactive.button_reply) &&
    typeof interactive.button_reply.id === 'string'
  )
    return interactive.button_reply.id;
  return undefined;
}
