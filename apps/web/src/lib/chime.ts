let ctx: AudioContext | null = null;
export function playChime() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ctx = ctx ?? new AC();
    const c = ctx as AudioContext;
    const t = c.currentTime;
    [660, 880].forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      const s = t + i * 0.12;
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.15, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.35);
      o.connect(g);
      g.connect(c.destination);
      o.start(s);
      o.stop(s + 0.4);
    });
  } catch {}
}
