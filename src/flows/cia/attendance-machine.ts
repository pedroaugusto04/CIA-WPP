import { AttendanceState } from '../../domain/attendance/types.js';
import type { AttendanceConfig, Session, Transition } from '../../domain/attendance/types.js';
import { normalizeInput } from '../../utils/template.js';
import type { InboundContent } from '../../types/whatsapp.js';
import { handoff, showMenu, showUnsupported, stateHandlers } from './handlers.js';
import { NavigationOption } from './constants.js';

/** Motor puro: decide a transição; envio e persistência pertencem ao serviço. */
export function transitionAttendance(
  session: Session | undefined,
  content: InboundContent,
  config: AttendanceConfig,
): Transition {
  if (session?.state === AttendanceState.HUMAN) {
    if (
      content.type === 'text' &&
      config.resumeEnabled &&
      normalizeInput(content.text) === config.resumeCommand
    ) {
      return showMenu(config);
    }
    return { state: AttendanceState.HUMAN, messages: [], invalidAttempts: 0 };
  }

  if (content.type === 'unsupported') {
    return showUnsupported(session?.state, config, session?.invalidAttempts ?? 0);
  }

  const input = content.type === 'text' ? normalizeInput(content.text) : content.id;

  if (content.type === 'selection' && input === NavigationOption.MENU) return showMenu(config);
  if (content.type === 'selection' && input === NavigationOption.HUMAN) return handoff(config);

  if (content.type === 'text' && config.humanCommands.includes(input)) {
    return handoff(config);
  }

  if (content.type === 'text' && config.menuCommands.includes(input)) {
    return showMenu(config);
  }

  if (!session) {
    const messages =
      content.type === 'selection'
        ? [
            { type: 'text' as const, body: config.staleSelectionMessage },
            ...showMenu(config).messages,
          ]
        : showMenu(config).messages;
    return { state: AttendanceState.MENU, messages, invalidAttempts: 0 };
  }

  return stateHandlers[session.state](input, config, session.invalidAttempts);
}
