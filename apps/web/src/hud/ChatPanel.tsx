import { type FormEvent, useEffect, useRef, useState } from 'react';
import { engineClient } from '../engine';
import type { ChatEntry } from '../lib/chat';
import type { ConversationTarget } from '../lib/proximity';
import { NO_INSET, insetFromPanel } from '../lib/viewInset';
import { useGameStore } from '../store/useGameStore';
import { CorrectionView, MarkedText } from './CorrectionView';

function noticeText(entry: Extract<ChatEntry, { kind: 'notice' }>): string {
  if (entry.tone === 'error') return `Something went wrong: ${entry.detail}`;
  return entry.detail === 'not_addressed'
    ? `${entry.speakerId} was not addressed and stayed quiet.`
    : `${entry.speakerId} stayed quiet.`;
}

/** The chat. Hidden until the learner starts a conversation, then docked at the side. */
export function ChatPanel() {
  const conversation = useGameStore((state) => state.conversation);
  return conversation ? <OpenChat conversation={conversation} /> : null;
}

function OpenChat({ conversation }: { conversation: ConversationTarget }) {
  const chat = useGameStore((state) => state.chat);
  const setChatFocused = useGameStore((state) => state.setChatFocused);
  const setViewInset = useGameStore((state) => state.setViewInset);
  const endConversation = useGameStore((state) => state.endConversation);
  const connected = chat.connection === 'connected';
  const [text, setText] = useState('');
  const panel = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // Tell the world how much screen the panel covers, so it can center the player in the rest.
  useEffect(() => {
    const element = panel.current!;
    const report = () =>
      setViewInset(
        insetFromPanel(element.getBoundingClientRect(), {
          width: window.innerWidth,
          height: window.innerHeight,
        }),
      );
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    window.addEventListener('resize', report);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', report);
      // The panel is gone: give the screen and the keyboard back to the world.
      setViewInset(NO_INSET);
      setChatFocused(false);
    };
  }, [setViewInset, setChatFocused]);

  // Start typing right away on desktop. Touch devices would pop the keyboard up over the world.
  // Focus is reported explicitly, not only through the focus event: if the input is already
  // focused (React StrictMode re-runs effects in development) there is no new event, and the
  // world would keep reading WASD while the learner types.
  useEffect(() => {
    if (!connected || window.matchMedia('(pointer: coarse)').matches) return;
    input.current?.focus();
    setChatFocused(document.activeElement === input.current);
  }, [connected, setChatFocused]);

  // Keep the newest line in view as text streams in.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [chat.entries]);

  const typing = Object.entries(chat.bubbles)
    .filter(([, bubble]) => bubble.typing)
    .map(([speakerId]) => speakerId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || !connected) return;
    engineClient.sendText(conversation, message);
    setText('');
  };

  return (
    <section ref={panel} className="chat" aria-label="Chat">
      <header className="chat-head">
        <span className="chat-title">
          {conversation.npcIds.join(', ')}
          {conversation.groupId ? ' (group)' : ''}
        </span>
        <button type="button" onClick={endConversation}>
          Close
        </button>
      </header>
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
                    <span className="msg-expression">{entry.expression}</span>
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
          ref={input}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setChatFocused(true)}
          onBlur={() => setChatFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') endConversation();
          }}
          disabled={!connected}
          placeholder={
            connected ? 'Escribe un mensaje…' : 'Waiting for the connection…'
          }
          aria-label="Message"
          autoComplete="off"
          enterKeyHint="send"
        />
        <button type="submit" disabled={!connected || !text.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
