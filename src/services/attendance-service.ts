import type { AttendanceConfig } from '../domain/attendance/types.js';
import { transitionAttendance } from '../flows/cia/attendance-machine.js';
import type { SessionRepository } from '../repositories/session-repository.js';
import type { HumanReplyEcho, InboundMessage, TextSender } from '../types/whatsapp.js';
import { SerialQueue } from '../utils/serial-queue.js';
import { combineOutboundMessages } from '../utils/outbound-message.js';

export class AttendanceService {
  private readonly queue = new SerialQueue();

  constructor(
    private readonly config: AttendanceConfig,
    private readonly repository: SessionRepository,
    private readonly sender: TextSender,
  ) {}

  process(message: InboundMessage): Promise<void> {
    return this.queue.run(async () => {
      if (this.repository.hasProcessed(message.id)) return;

      const transition = transitionAttendance(
        this.repository.get(message.from),
        message.content,
        this.config,
      );
      for (const outbound of combineOutboundMessages(transition.messages)) {
        await this.sender.send(message.from, outbound);
      }
      await this.repository.commit(
        message.from,
        transition.state,
        message.id,
        Date.now(),
        transition.invalidAttempts,
      );
    });
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
