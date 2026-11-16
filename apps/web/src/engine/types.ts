// The events the HUD consumes. They mirror the crowspeak-core domain events
// (`crowspeak-core/src/crowspeak_engine/events.py`, `corrections.py`), as a TypeScript union.
// The wire format is not decided yet (the protocol task), so field names are camelCase here and
// the typed engine adapter (task 8) will map the wire to these. No Phaser or React imports.

export type Role = 'system' | 'user' | 'assistant';
export type Expression =
  'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking';
export type CorrectionCategory =
  | 'grammar'
  | 'vocabulary'
  | 'spelling'
  | 'naturalness'
  | 'punctuation'
  | 'accents';
/** `error` is something wrong; `suggestion` is something that could be better. */
export type CorrectionSeverity = 'error' | 'suggestion';

export interface CorrectionItem {
  original: string; // the quoted part of the learner's message
  suggestion: string;
  category: CorrectionCategory;
  severity: CorrectionSeverity;
  explanation: string;
  explanationLanguage: string;
  /** Character offsets into the learner's message, or null if the quote was not found. */
  span: { start: number; end: number } | null;
  confidence: number | null;
}

export interface Corrections {
  language: string; // the learner's target language, e.g. "es-MX"
  original: string;
  corrected: string;
  isCorrect: boolean;
  /** What to show first, then `more`: minor fixes and anything over the cap. */
  items: CorrectionItem[];
  praise: string | null;
  more: CorrectionItem[];
}

export interface EngineMessage {
  id: string;
  role: Role;
  content: string;
  interrupted: boolean;
}

interface Base {
  sessionId: string;
}
/** Conversation events say who is talking: an NPC id, or the learner's id. */
interface InConversation extends Base {
  conversationId: string;
  speakerId: string;
}

export type EngineEvent =
  | (Base & { type: 'session_started'; learnerId: string })
  /** The learner's own message. The client emits it as it sends, so every message takes one path. */
  | (InConversation & {
      type: 'learner_message';
      messageId: string;
      text: string;
    })
  /** Provisional: the session model spike plans explicit turn-started and turn-skipped events. */
  | (InConversation & { type: 'turn_started' })
  | (InConversation & { type: 'turn_skipped'; reason: string })
  | (InConversation & {
      type: 'transcript_delta';
      text: string;
      role: Role;
      final: boolean;
    })
  | (InConversation & { type: 'expression_change'; label: Expression })
  | (InConversation & { type: 'turn_completed'; message: EngineMessage })
  | (InConversation & {
      type: 'corrections_ready';
      messageId: string;
      corrections: Corrections;
    })
  | (InConversation & {
      type: 'analyzer_error';
      analyzer: string;
      messageId: string;
      message: string;
    })
  | (InConversation & {
      type: 'engine_error';
      message: string;
      recoverable: boolean;
    });

export type ConnectionStatus =
  'connecting' | 'connected' | 'reconnecting' | 'offline';

/** Everything the HUD reacts to: engine events plus the client's own connection status. */
export type ClientEvent =
  EngineEvent | { type: 'connection_changed'; status: ConnectionStatus };
