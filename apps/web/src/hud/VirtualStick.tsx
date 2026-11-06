import { useRef } from 'react';
import { setVirtualStick } from '../world/virtualStick';

const RADIUS = 40;

/** On-screen stick for touch devices. Writes its vector to `virtualStick` for the scene. */
export function VirtualStick() {
  const base = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);

  const update = (clientX: number, clientY: number) => {
    const rect = base.current!.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > RADIUS) {
      dx = (dx / length) * RADIUS;
      dy = (dy / length) * RADIUS;
    }
    // Move the thumb directly: this changes every frame and React has no need to re-render.
    thumb.current!.style.transform = `translate(${dx}px, ${dy}px)`;
    setVirtualStick(dx / RADIUS, dy / RADIUS);
  };

  const release = () => {
    thumb.current!.style.transform = '';
    setVirtualStick(0, 0);
  };

  return (
    <div
      ref={base}
      className="stick"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          update(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div ref={thumb} className="stick-thumb" />
    </div>
  );
}
