// Phone controls: drag anywhere as an analogue stick (up = gas, down = brake/reverse, sideways = steer),
// plus a small row of buttons that fake their keyboard key, so input.ts and the flip/reset handlers work unchanged.
const BUTTONS = [
  { code: 'KeyL', label: 'Hi/Lo' },
  { code: 'KeyP', label: 'Air −' },
  { code: 'KeyO', label: 'Air +' },
  { code: 'KeyF', label: 'Flip' },
  { code: 'KeyT', label: 'Reset' },
];
const RADIUS = 60; // px of drag for full throttle/steer

// Read by input.ts; x: -1 left .. 1 right, y: -1 up .. 1 down.
export const stick = { x: 0, y: 0 };

export function createTouchControls() {
  if (!matchMedia('(pointer: coarse)').matches) return; // desktop keeps keyboard/gamepad only

  const root = document.createElement('div');
  root.id = 'touch';
  const tools = document.createElement('div');
  tools.className = 'tools';
  const ring = document.createElement('div');
  ring.className = 'ring';
  const knob = document.createElement('div');
  knob.className = 'knob';
  ring.append(knob);
  root.append(tools, ring);

  for (const b of BUTTONS) {
    const el = document.createElement('button');
    el.textContent = b.label;
    const send = (type: 'keydown' | 'keyup') => dispatchEvent(new KeyboardEvent(type, { code: b.code }));
    el.addEventListener('pointerdown', (e) => {
      send('keydown');
      el.setPointerCapture(e.pointerId); // finger sliding off still releases this button
    });
    el.addEventListener('pointerup', () => send('keyup'));
    el.addEventListener('pointercancel', () => send('keyup'));
    tools.append(el);
  }
  addEventListener('contextmenu', (e) => e.preventDefault());

  let finger: number | null = null; // one drag at a time; the buttons take other fingers
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

  document.body.append(root);
}
