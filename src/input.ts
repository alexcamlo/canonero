export type Input = { throttle: number; brake: number; steer: number; rangeToggle: boolean; airDown: boolean; compressor: boolean }; // steer: +1 = left

const down = new Set<string>();
addEventListener('keydown', (e) => down.add(e.code));
addEventListener('keyup', (e) => down.delete(e.code));
addEventListener('blur', () => down.clear());

const key = (...codes: string[]) => (codes.some((c) => down.has(c)) ? 1 : 0);
const stronger = (a: number, b: number) => (Math.abs(a) >= Math.abs(b) ? a : b);

const DEADZONE = 0.12;
const deadzone = (v: number) => (Math.abs(v) < DEADZONE ? 0 : v);

let rangeHeld = false; // for edge detection across frames

export function readInput(): Input {
  const pad = Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected && p.mapping === 'standard');
  const rangeHeldNow = key('KeyL') > 0 || !!pad?.buttons[3]?.pressed; // Y
  const rangeToggle = rangeHeldNow && !rangeHeld;
  rangeHeld = rangeHeldNow;
  return {
    throttle: stronger(key('KeyW', 'ArrowUp'), pad?.buttons[7]?.value ?? 0), // RT
    brake: stronger(key('KeyS', 'ArrowDown'), pad?.buttons[6]?.value ?? 0), // LT; brakes while rolling forward, reverses once stopped
    steer: stronger(key('KeyA', 'ArrowLeft') - key('KeyD', 'ArrowRight'), -deadzone(pad?.axes[0] ?? 0)),
    rangeToggle,
    airDown: key('KeyP') > 0 || !!pad?.buttons[13]?.pressed, // dpad down
    compressor: key('KeyO') > 0 || !!pad?.buttons[12]?.pressed, // dpad up
  };
}
