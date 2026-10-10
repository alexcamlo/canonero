// On-screen buttons for phones. Each one fakes its keyboard key, so input.ts and the flip/reset handlers work unchanged.
const BUTTONS = [
  { code: 'KeyA', label: '◀', area: 'left' },
  { code: 'KeyD', label: '▶', area: 'right' },
  { code: 'KeyS', label: 'Brake', area: 'brake' },
  { code: 'KeyW', label: 'Gas', area: 'gas' },
  { code: 'KeyL', label: 'Hi/Lo', area: 'tools' },
  { code: 'KeyP', label: 'Air −', area: 'tools' },
  { code: 'KeyO', label: 'Air +', area: 'tools' },
  { code: 'KeyF', label: 'Flip', area: 'tools' },
  { code: 'KeyT', label: 'Reset', area: 'tools' },
];

export function createTouchControls() {
  if (!matchMedia('(pointer: coarse)').matches) return; // desktop keeps keyboard/gamepad only

  const root = document.createElement('div');
  root.id = 'touch';
  const tools = document.createElement('div');
  tools.className = 'tools';
  root.append(tools);

  for (const b of BUTTONS) {
    const el = document.createElement('button');
    el.textContent = b.label;
    el.setAttribute('aria-label', b.code === 'KeyA' ? 'Steer left' : b.code === 'KeyD' ? 'Steer right' : b.label);
    el.className = b.area;
    const send = (type: 'keydown' | 'keyup') => dispatchEvent(new KeyboardEvent(type, { code: b.code }));
    el.addEventListener('pointerdown', (e) => {
      send('keydown');
      el.setPointerCapture(e.pointerId); // finger sliding off still releases this button
    });
    el.addEventListener('pointerup', () => send('keyup'));
    el.addEventListener('pointercancel', () => send('keyup'));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    (b.area === 'tools' ? tools : root).append(el);
  }
  document.body.append(root);
}
