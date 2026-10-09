export type Input = { throttle: number; brake: number; steer: number }; // steer: +1 = left

const down = new Set<string>();
addEventListener('keydown', (e) => down.add(e.code));
addEventListener('keyup', (e) => down.delete(e.code));
addEventListener('blur', () => down.clear());

const key = (...codes: string[]) => (codes.some((c) => down.has(c)) ? 1 : 0);

export function readInput(): Input {
  return {
    throttle: key('KeyW', 'ArrowUp'),
    brake: key('KeyS', 'ArrowDown'), // brakes while rolling forward, reverses once stopped
    steer: key('KeyA', 'ArrowLeft') - key('KeyD', 'ArrowRight'),
  };
}
