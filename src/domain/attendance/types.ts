export const AttendanceState = {
  MENU: 'MENU',
  PROFILE: 'PROFILE',
  FAQ: 'FAQ',
  HUMAN: 'HUMAN',
} as const;

export type AttendanceState = (typeof AttendanceState)[keyof typeof AttendanceState];

export interface Session {
  state: AttendanceState;
  updatedAt: number;
  invalidAttempts: number;
}

export interface Transition {
  state: AttendanceState;
  messages: OutboundMessage[];
  invalidAttempts: number;
}

export interface InteractiveList {
  type: 'list';
  body: string;
  button: string;
  section: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}

export type OutboundMessage = { type: 'text'; body: string } | InteractiveList;

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export interface ResourceConfig {
  message: string;
  url?: string;
}

export interface AttendanceConfig {
  menuMessage: string;
  menuLabels: {
    parents: string;
    adults: string;
    welcome: string;
    teativo: string;
    identification: string;
    faq: string;
    human: string;
  };
  profileLabels: {
    mother_or_father: string;
    family_member: string;
    autistic_adult: string;
  };
  menuCommands: string[];
  humanCommands: string[];
  resumeEnabled: boolean;
  resumeCommand: string | undefined;
  invalidOptionMessage: string;
  repeatedInvalidOptionMessage: string;
  staleSelectionMessage: string;
  unsupportedMessage: string;
  navigationMessage: string;
  humanMessage: string;
  resourceUnavailableMessage: string;
  parents: ResourceConfig;
  teativo: ResourceConfig;
  identification: ResourceConfig;
  adultsMessage: string;
  profileMessage: string;
  profileConfirmationMessage: string;
  faqTitle: string;
  faqEmptyMessage: string;
  faqs: FaqEntry[];
  faqBackLabel: string;
  profileBackLabel: string;
  profileHumanLabel: string;
  menuButton: string;
  menuSection: string;
  profileButton: string;
  profileSection: string;
  faqButton: string;
  faqSection: string;
}
