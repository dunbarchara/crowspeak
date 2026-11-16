import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { screenAnchors } from '../world/screenAnchors';

/** How long a finished bubble stays, and the most text one shows. */
const LIFETIME_MS = 7_000;
const MAX_CHARS = 140;

/**
 * Speech bubbles over the canvas. The text comes from the store, but the position changes every
 * frame, so one animation loop moves the elements directly from `screenAnchors` and React never
 * re-renders for movement. A speaker with no anchor on screen is hidden.
 */
export function SpeechBubbles() {
  const bubbles = useGameStore((state) => state.chat.bubbles);
  const learnerId = useGameStore((state) => state.chat.learnerId);
  const [now, setNow] = useState(() => Date.now());
  const elements = useRef(new Map<string, HTMLDivElement>());

  const live = Object.entries(bubbles).filter(
    ([, bubble]) => bubble.typing || now - bubble.at < LIFETIME_MS,
  );

  // Tick only while something could expire.
  useEffect(() => {
    if (live.length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [live.length]);

  useEffect(() => {
    let frame = 0;
    const place = () => {
      for (const [speakerId, element] of elements.current) {
        const anchor = screenAnchors.get(
          speakerId === learnerId ? 'player' : speakerId,
        );
        element.style.visibility = anchor ? 'visible' : 'hidden';
        if (anchor) {
          element.style.transform = `translate(${anchor.x}px, ${anchor.y}px) translate(-50%, -100%)`;
        }
      }
      frame = requestAnimationFrame(place);
    };
    frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [learnerId]);

  return (
    <>
      {live.map(([speakerId, bubble]) => (
        <div
          key={speakerId}
          ref={(element) => {
            if (element) elements.current.set(speakerId, element);
            else elements.current.delete(speakerId);
          }}
          className="bubble"
          data-self={speakerId === learnerId}
          style={{ visibility: 'hidden' }}
        >
          {bubble.typing ? (
            <span className="dots" aria-label="typing">
              <i />
              <i />
              <i />
            </span>
          ) : bubble.text.length > MAX_CHARS ? (
            `…${bubble.text.slice(-MAX_CHARS)}`
          ) : (
            bubble.text
          )}
        </div>
      ))}
    </>
  );
}
