export const HUD = {
  hold: 3, // seconds the indicators stay up after the last change
  sinkWarn: 0.3, // max wheel sinkage that raises the warning
};

// Seconds since something last changed.
export const hudIdle = (idle: number, changed: boolean, dt: number) => (changed ? 0 : idle + dt);

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// Compass reading for a forward vector (north = -z, east = +x).
export const compass = (fx: number, fz: number) => {
  const deg = ((Math.atan2(fx, -fz) * 180) / Math.PI + 360) % 360;
  return `${POINTS[Math.round(deg / 45) % 8]} ${Math.round(deg)}°`;
};

type State = { sinkage: number[] };

export function createHud() {
  const make = (id: string) => {
    const el = document.createElement('div');
    el.id = id;
    document.body.append(el);
    return el;
  };
  const panel = make('hud');
  const warning = make('hud-warning');
  warning.setAttribute('aria-live', 'polite');
  const compassEl = document.createElement('span');
  panel.append(compassEl);

  let idle = HUD.hold;
  let wasSinking: boolean | undefined;
  const set = (el: HTMLElement, text: string) => {
    if (el.textContent !== text) el.textContent = text; // don't touch the DOM every frame
  };

  return {
    // (fx, fz) is the truck's forward vector on the ground plane.
    update(s: State, fx: number, fz: number, dt: number) {
      const sinking = Math.max(...s.sinkage) > HUD.sinkWarn;
      idle = hudIdle(idle, sinking !== wasSinking, dt);
      wasSinking = sinking;
      set(compassEl, compass(fx, fz));
      set(warning, sinking ? 'Sinking — rock the truck or steer side to side' : '');
      panel.style.opacity = idle < HUD.hold ? '1' : '0';
      warning.style.opacity = sinking ? '1' : '0';
    },
  };
}
