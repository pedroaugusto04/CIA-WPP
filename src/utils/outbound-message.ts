import type { OutboundMessage } from '../types/whatsapp.js';
import { MAX_INTERACTIVE_BODY_LENGTH, MAX_TEXT_BODY_LENGTH } from '../constants/whatsapp.js';

const MESSAGE_SEPARATOR = '\n\n';

/** Combina uma transição num único envio, preservando a lista interativa quando existe. */
export function combineOutboundMessages(messages: OutboundMessage[]): OutboundMessage[] {
  if (messages.length === 0) return [];

  const list = messages.find((message) => message.type === 'list');
  const body = messages
    .map((message) => message.body)
    .filter((part) => part.length > 0)
    .join(MESSAGE_SEPARATOR);

  if (list && body.length <= MAX_INTERACTIVE_BODY_LENGTH) return [{ ...list, body }];
  if (list) {
    const listIndex = messages.indexOf(list);
    const before = messages
      .slice(0, listIndex)
      .map((message) => message.body)
      .join(MESSAGE_SEPARATOR);
    const after = messages
      .slice(listIndex + 1)
      .map((message) => message.body)
      .join(MESSAGE_SEPARATOR);
    return [
      ...splitText(before).map((part) => ({ type: 'text' as const, body: part })),
      list,
      ...splitText(after).map((part) => ({ type: 'text' as const, body: part })),
    ];
  }

  if (body.length <= MAX_TEXT_BODY_LENGTH) return [{ type: 'text', body }];

  return splitText(body).map((part) => ({ type: 'text', body: part }));
}

function splitText(body: string): string[] {
  const parts: string[] = [];
  let remaining = body;

  while (remaining.length > MAX_TEXT_BODY_LENGTH) {
    let boundary = remaining.lastIndexOf(MESSAGE_SEPARATOR, MAX_TEXT_BODY_LENGTH);
    if (boundary <= 0) boundary = remaining.lastIndexOf(' ', MAX_TEXT_BODY_LENGTH);
    if (boundary <= 0) boundary = MAX_TEXT_BODY_LENGTH;
    parts.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }

  if (remaining.length > 0) parts.push(remaining);
  return parts;
}
