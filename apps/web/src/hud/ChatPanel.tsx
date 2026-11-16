import { type FormEvent, useEffect, useRef, useState } from 'react';
import { engineClient } from '../engine';
import type { ChatEntry } from '../lib/chat';
import { useGameStore } from '../store/useGameStore';
import { CorrectionView, MarkedText } from './CorrectionView';

function noticeText(entry: Extract<ChatEntry, { kind: 'notice' }>): string {
  if (entry.tone === 'error') return `Something went wrong: ${entry.detail}`;
  return entry.detail === 'not_addressed'
    ? `${entry.speakerId} was not addressed and stayed quiet.`
    : `${entry.speakerId} stayed quiet.`;
}

/** Chat and transcript. A side panel on wide screens, docked at the top on narrow ones. */
export function ChatPanel() {
  const target = useGameStore((state) => state.target);
  const chat = useGameStore((state) => state.chat);
  const setChatFocused = useGameStore((state) => state.setChatFocused);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(true);
  const list = useRef<HTMLOListElement>(null);

  // Keep the newest line in view as text streams in.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [chat.entries]);

  const typing = Object.entries(chat.bubbles)
    .filter(([, bubble]) => bubble.typing)
    .map(([speakerId]) => speakerId);
  const connected = chat.connection === 'connected';
  const canSend = target !== null && connected;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || !target || !connected) return;
    engineClient.sendText(target, message);
    setText('');
  };

  return (
    <section className="chat" data-open={open} aria-label="Chat">
      <header className="chat-head">
        <span className="chat-title">
          {target
            ? `Talking to ${target.npcIds.join(', ')}${target.groupId ? ' (group)' : ''}`
            : 'Walk up to someone to talk'}
        </span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </header>
      {open && (
        <>
          <ol ref={list} className="transcript" aria-live="polite">
            {chat.entries.length === 0 && (
              <li className="notice">No messages yet.</li>
            )}
            {chat.entries.map((entry) =>
              entry.kind === 'notice' ? (
                <li key={entry.id} className="notice" data-tone={entry.tone}>
                  {noticeText(entry)}
                </li>
              ) : (
                <li key={entry.id} className="msg" data-role={entry.role}>
                  {entry.role === 'assistant' && (
                    <span className="msg-who">
                      {entry.speakerId}
                      {entry.expression && (
                        <span className="msg-expression">
                          {entry.expression}
                        </span>
                      )}
                    </span>
                  )}
                  <span className="msg-text">
                    {entry.role === 'user' ? (
                      <MarkedText
                        text={entry.text}
                        corrections={entry.corrections}
                      />
                    ) : (
                      entry.text
                    )}
                    {entry.streaming && <span className="caret" />}
                    {entry.interrupted && ' …'}
                  </span>
                  {entry.corrections && (
                    <CorrectionView corrections={entry.corrections} />
                  )}
                </li>
              ),
            )}
          </ol>
          {typing.length > 0 && (
            <p className="typing">{typing.join(', ')} typing…</p>
          )}
          <form className="chat-form" onSubmit={submit}>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setChatFocused(true)}
              onBlur={() => setChatFocused(false)}
              disabled={!canSend}
              placeholder={
                !connected
                  ? 'Waiting for the connection…'
                  : target
                    ? 'Escribe un mensaje…'
                    : 'Nobody in range'
              }
              aria-label="Message"
              autoComplete="off"
              enterKeyHint="send"
            />
            <button type="submit" disabled={!canSend || !text.trim()}>
              Send
            </button>
          </form>
        </>
      )}
    </section>
  );
}
