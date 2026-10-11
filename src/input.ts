import { stick } from './touch';

export type Input = { throttle: number; brake: number; steer: number; viewToggle: boolean }; // steer: +1 = left

const down = new Set<string>();
addEventListener('keydown', (e) => down.add(e.code));
addEventListener('keyup', (e) => down.delete(e.code));
addEventListener('blur', () => down.clear());

const key = (...codes: string[]) => (codes.some((c) => down.has(c)) ? 1 : 0);
const stronger = (a: number, b: number) => (Math.abs(a) >= Math.abs(b) ? a : b);

const DEADZONE = 0.12;
const deadzone = (v: number) => (Math.abs(v) < DEADZONE ? 0 : v);

let viewHeld = false; // the keyboard V toggle is a keydown handler in main.ts, so this edge is gamepad only

export function readInput(): Input {
  const pad = Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected && p.mapping === 'standard');
  const viewHeldNow = !!pad?.buttons[8]?.pressed; // View/Back
  const viewToggle = viewHeldNow && !viewHeld;
  viewHeld = viewHeldNow;
  return {
    throttle: Math.max(key('KeyW', 'ArrowUp'), pad?.buttons[7]?.value ?? 0, deadzone(-stick.y)), // RT, drag up
    brake: Math.max(key('KeyS', 'ArrowDown'), pad?.buttons[6]?.value ?? 0, deadzone(stick.y)), // LT, drag down; brakes while rolling forward, reverses once stopped
    steer: stronger(stronger(key('KeyA', 'ArrowLeft') - key('KeyD', 'ArrowRight'), -deadzone(pad?.axes[0] ?? 0)), -deadzone(stick.x)),
    viewToggle,
  };
}
