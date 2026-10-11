const TRACKS = [
  { file: 'jungle', title: 'Chill Jungle', artist: 'Alex McCulloch' },
  { file: 'stretch', title: 'Empty Stretch', artist: 'Zane Little' },
  { file: 'hypnotic', title: 'Hypnotic Chill', artist: 'cynicmusic' },
  { file: 'desert', title: 'Desert Loop', artist: 'iamoneabe' },
  { file: 'jungle2', title: 'Chill Jungle 2', artist: 'Alex McCulloch' },
  { file: 'radio', title: 'Old Broken Radio', artist: 'Gichco' },
];

export const nextTrackIndex = (index: number) => (index + 1) % TRACKS.length;

export function createRadio() {
  const audio = new Audio();
  audio.preload = 'none';
  audio.volume = 0.5;
  const button = document.createElement('button');
  button.id = 'radio';
  button.innerHTML = 'Radio <kbd>R</kbd>';
  button.title = 'Radio: cycle tracks, then off (R: on/off, N: next)';
  button.setAttribute('aria-pressed', 'false');
  document.querySelector('#touch')!.append(button);
  const label = document.createElement('div');
  label.id = 'radio-track';
  label.setAttribute('role', 'status');
  document.body.append(label);

  let index = 0;
  let on = false;
  let request = 0;
  let timer = 0;
  const show = (text: string) => {
    label.textContent = text;
    label.style.opacity = '1';
    clearTimeout(timer);
    timer = window.setTimeout(() => { label.style.opacity = '0'; }, 3000);
  };
  const stop = (message = 'Radio off') => {
    ++request;
    on = false;
    audio.pause();
    button.setAttribute('aria-pressed', 'false');
    show(message);
  };
  const play = () => {
    if (document.hidden) return;
    const track = TRACKS[index];
    const src = `radio/${track.file}.m4a`; // relative to the page, including GitHub Pages' repo path
    if (audio.getAttribute('src') !== src) audio.src = src;
    const attempt = ++request;
    on = true;
    button.setAttribute('aria-pressed', 'true');
    show(`${track.title} · ${track.artist}`);
    // Keep play in the gesture handler; ignore rejections from an earlier skip/pause.
    void audio.play().catch(() => {
      if (attempt === request) stop('Radio unavailable — tap to retry');
    });
  };
  const next = () => {
    index = nextTrackIndex(index);
    play();
  };
  button.addEventListener('click', () => {
    if (!on) play();
    else if (nextTrackIndex(index) === 0) {
      stop();
      index = 0;
    } else next();
  });
  addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyR') on ? stop() : play();
    if (e.code === 'KeyN') next();
  });
  audio.addEventListener('ended', () => { if (on) next(); });
  audio.addEventListener('error', () => { if (on) stop('Radio unavailable — tap to retry'); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && on) stop('Radio paused — tap to resume');
  });
}
