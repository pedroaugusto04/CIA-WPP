export const WHATSAPP_GRAPH_ORIGIN = 'https://graph.facebook.com';
export const WhatsAppField = {
  MESSAGES: 'messages',
  SMB_MESSAGE_ECHOES: 'smb_message_echoes',
} as const;
export const WhatsAppMessageType = {
  TEXT: 'text',
  INTERACTIVE: 'interactive',
  REACTION: 'reaction',
} as const;
export const WHATSAPP_PRODUCT = 'whatsapp';
export const WHATSAPP_RECIPIENT_TYPE = 'individual';
export const WEBHOOK_SUBSCRIPTION_MODE = 'subscribe';
export const MAX_TEXT_BODY_LENGTH = 4096;
export const MAX_INTERACTIVE_BODY_LENGTH = 1024;

export const WebhookQuery = {
  MODE: 'hub.mode',
  VERIFY_TOKEN: 'hub.verify_token',
  CHALLENGE: 'hub.challenge',
} as const;

export const WebhookResponse = {
  RECEIVED: 'EVENT_RECEIVED',
  FORBIDDEN: 'Forbidden',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  INVALID_REQUEST: 'INVALID_REQUEST',
} as const;
