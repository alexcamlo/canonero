// On-screen controls: Flip and View buttons everywhere (they fake the F and C keys, so the existing keydown
// handlers work unchanged), plus, on touch screens, drag anywhere as an analogue stick
// (up = gas, down = brake/reverse, sideways = steer). Range, air and reset stay keyboard/gamepad only.
const RADIUS = 60; // px of drag for full throttle/steer

// Read by input.ts; x: -1 left .. 1 right, y: -1 up .. 1 down.
export const stick = { x: 0, y: 0 };

export function createTouchControls() {
  const root = document.createElement('div');
  root.id = 'touch';
  document.body.append(root);

  const flip = document.createElement('button');
  flip.textContent = 'Flip';
  flip.title = 'Flip upright (F)';
  flip.addEventListener('pointerdown', () => dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' })));
  const view = document.createElement('button');
  view.textContent = 'View';
  view.title = 'Chase / hood camera (C)';
  view.addEventListener('pointerdown', () => dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' })));
  root.append(flip, view);
  if (!matchMedia('(pointer: coarse)').matches) return; // mouse/keyboard: no drag stick

  addEventListener('contextmenu', (e) => e.preventDefault());
  const ring = document.createElement('div');
  ring.className = 'ring';
  const knob = document.createElement('div');
  knob.className = 'knob';
  ring.append(knob);
  root.append(ring);

  let finger: number | null = null; // one drag at a time; other fingers can tap Flip or View
  let ox = 0;
  let oy = 0;
  addEventListener('pointerdown', (e) => {
    if (finger !== null || (e.target as Element).closest('button')) return;
    finger = e.pointerId;
    [ox, oy] = [e.clientX, e.clientY];
    ring.style.transform = `translate(${ox}px, ${oy}px)`;
    ring.style.opacity = '1';
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerId !== finger) return;
    let dx = e.clientX - ox;
    let dy = e.clientY - oy;
    const k = Math.min(1, RADIUS / Math.hypot(dx, dy)); // clamp to the ring
    dx *= k;
    dy *= k;
    stick.x = dx / RADIUS;
    stick.y = dy / RADIUS;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const release = (e: PointerEvent) => {
    if (e.pointerId !== finger) return;
    finger = null;
    stick.x = stick.y = 0;
    knob.style.transform = '';
    ring.style.opacity = '0';
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
}
