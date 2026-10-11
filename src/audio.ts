import { GEARBOX } from './gearbox';

export const AUDIO = {
  master: 0.65,
  smooth: 0.08, // seconds, to soften gear shifts and landings
  engineIdle: 0.65,
  engineLoad: 0.35,
  engineRate: 2.1,
  windGain: 0.45,
  windSpeed: 30, // m/s for full wind
  sandGain: 0.3,
  sandSpeed: 10, // m/s for full crunch
  sandCutoff: 500, // Hz; the pour recording's grains crackle like twigs above this, below it they hiss
  looseBoost: 0.5,
};

type State = { rpm: number; throttle: number; speed: number; wheelSpeed: number; sinkage: number };
const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function audioMix(s: State) {
  const rpm = clamp((s.rpm - GEARBOX.idleRpm) / (1 - GEARBOX.idleRpm));
  const wind = clamp(Math.abs(s.speed) / AUDIO.windSpeed);
  const sand = clamp(s.wheelSpeed / AUDIO.sandSpeed);
  return {
    engineGain: AUDIO.engineIdle + AUDIO.engineLoad * clamp(s.throttle),
    engineRate: 1 + (AUDIO.engineRate - 1) * rpm,
    windGain: AUDIO.windGain * wind * wind,
    windRate: 0.9 + 0.25 * wind,
    sandGain: AUDIO.sandGain * sand * (1 + AUDIO.looseBoost * clamp(s.sinkage)),
    sandRate: 0.8 + 0.15 * sand,
  };
}

export function createAudio() {
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let loading = false;
  let muted = false;
  const loops: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
  const button = document.createElement('button');
  button.id = 'audio';
  const showMute = () => {
    button.textContent = muted ? '🔇' : '🔊';
    button.title = muted ? 'Unmute audio (M)' : 'Mute audio (M)';
    button.setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
    button.setAttribute('aria-pressed', String(muted));
  };
  showMute();
  document.getElementById('touch')!.append(button);
  const volume = () => {
    if (context && master) master.gain.setTargetAtTime(muted || document.hidden ? 0 : AUDIO.master, context.currentTime, AUDIO.smooth);
  };
  const toggle = () => { muted = !muted; showMute(); volume(); };
  button.addEventListener('click', toggle);

  async function load(ctx: AudioContext) {
    loading = true;
    try {
      const buffers = await Promise.all(['engine', 'wind', 'sand'].map(async (name) => {
        const response = await fetch(`./audio/${name}.m4a`);
        if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
        return ctx.decodeAudioData(await response.arrayBuffer());
      }));
      for (const [i, buffer] of buffers.entries()) {
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = buffer;
        source.loop = true;
        gain.gain.value = 0;
        if (i === 2) source.connect(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: AUDIO.sandCutoff })).connect(gain);
        else source.connect(gain);
        gain.connect(master!);
        source.start();
        loops.push({ source, gain });
      }
      volume();
      showMute();
    } catch (error) {
      console.warn('Audio could not load; the next gesture will retry.', error);
      button.title = 'Audio unavailable; tap to retry';
    } finally {
      loading = false;
    }
  }

  function start() {
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
    }
    // Resume inside the gesture, before fetch/decode yields, including after iOS interrupts audio.
    void context.resume().catch((error) => console.warn('Audio could not resume.', error));
    if (!loading && !loops.length) void load(context);
  }
  addEventListener('pointerdown', start);
  addEventListener('keydown', (e) => {
    start();
    if (e.code === 'KeyM' && !e.repeat) toggle();
  });
  document.addEventListener('visibilitychange', () => {
    volume();
    if (!context) return;
    if (document.hidden) void context.suspend().catch((error) => console.warn('Audio could not suspend.', error));
    else start();
  });

  return {
    update(s: State) {
      if (!context || loops.length !== 3) return;
      const mix = audioMix(s);
      const time = context.currentTime;
      // shortcut: one steady Hilux recording; replace with RPM bands after recordings are judged by ear.
      loops[0].gain.gain.setTargetAtTime(mix.engineGain, time, AUDIO.smooth);
      loops[0].source.playbackRate.setTargetAtTime(mix.engineRate, time, AUDIO.smooth);
      loops[1].gain.gain.setTargetAtTime(mix.windGain, time, AUDIO.smooth);
      loops[1].source.playbackRate.setTargetAtTime(mix.windRate, time, AUDIO.smooth);
      loops[2].gain.gain.setTargetAtTime(mix.sandGain, time, AUDIO.smooth);
      loops[2].source.playbackRate.setTargetAtTime(mix.sandRate, time, AUDIO.smooth);
    },
  };
}
