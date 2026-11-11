export interface InboundMessage {
  from: string;
  id: string;
  content: InboundContent;
}

export interface HumanReplyEcho {
  to: string;
  id: string;
}

export type InboundContent =
  | { type: 'text'; text: string }
  | { type: 'selection'; id: string }
  | { type: 'unsupported'; messageType: string };

export interface OutboundList {
  type: 'list';
  body: string;
  button: string;
  section: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}

export type OutboundMessage = { type: 'text'; body: string } | OutboundList;

export interface TextSender {
  send(to: string, message: OutboundMessage): Promise<void>;
}
