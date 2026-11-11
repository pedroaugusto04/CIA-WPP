import type { AttendanceConfig } from '../domain/attendance/types.js';
import { transitionAttendance } from '../flows/cia/attendance-machine.js';
import type { SessionRepository } from '../repositories/session-repository.js';
import type { HumanReplyEcho, InboundMessage, TextSender } from '../types/whatsapp.js';
import { SerialQueue } from '../utils/serial-queue.js';
import { combineOutboundMessages } from '../utils/outbound-message.js';
import type { FastifyBaseLogger } from 'fastify';

export class AttendanceService {
  private readonly queue = new SerialQueue();

  constructor(
    private readonly config: AttendanceConfig,
    private readonly repository: SessionRepository,
    private readonly sender: TextSender,
    private readonly limits: Pick<import('../config/env.js').AppConfig, 'shortLimitMessage'> = { shortLimitMessage: 'Recebemos várias mensagens em pouco tempo. Aguarde um pouco e tente novamente.' },
    private readonly logger?: FastifyBaseLogger,
  ) {}

  process(message: InboundMessage): Promise<void> {
    return this.queue.run(async () => {
      if (this.repository.hasProcessed(message.id)) {
        this.logProcessed(message, 'duplicada');
        return;
      }

      const transition = transitionAttendance(
        this.repository.get(message.from),
        message.content,
        this.config,
      );
      for (const outbound of combineOutboundMessages(transition.messages)) {
        const limit = await this.repository.reserveOutbound(message.from);
        if (limit === 'monthly') break;
        if (limit === 'short') await this.sender.send(message.from, { type: 'text', body: this.limits.shortLimitMessage });
        if (limit === 'short' || limit === 'short-silent') break;
        await this.sender.send(message.from, outbound);
      }
      await this.repository.commit(
        message.from,
        transition.state,
        message.id,
        Date.now(),
        transition.invalidAttempts,
      );
      this.logProcessed(message, 'processada');
    });
  }

  private logProcessed(message: InboundMessage, result: string): void {
    this.logger?.info({
      result,
      contentType: message.content.type,
      sessionState: this.repository.get(message.from)?.state ?? 'MENU',
      ...this.repository.getOperationalStats(),
    }, 'Mensagem recebida processada');
  }

  processHumanReply(echo: HumanReplyEcho): Promise<void> {
    return this.queue.run(async () => {
      if (this.repository.hasProcessed(echo.id)) return;
      await this.repository.commit(echo.to, 'HUMAN', echo.id);
    });
  }

  cleanup(): Promise<void> {
    return this.queue.run(() => this.repository.cleanup());
  }

  drain(): Promise<void> {
    return this.queue.drain();
  }
}
