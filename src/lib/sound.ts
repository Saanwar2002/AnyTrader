import { triggerHaptic, ImpactStyle } from './capacitor';

export function playSound(type: 'alert' | 'success' | 'notification' = 'notification') {
  if (typeof window === 'undefined') return;

  // Always trigger native haptic feedback on Capacitor
  triggerHaptic(type === 'alert' ? ImpactStyle.Heavy : ImpactStyle.Medium).catch(() => {});

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === 'alert' || type === 'notification') {
      // Pleasant dual-tone chime (E5 -> A5)
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(880.00, now + 0.12); // A5

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.5, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.05, now + 0.12);
      gainNode.gain.linearRampToValueAtTime(0.6, now + 0.14);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'success') {
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.linearRampToValueAtTime(783.99, now + 0.1); // G5
      osc.type = 'sine';
      gainNode.gain.setValueAtTime(0.4, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (err) {
    console.error('AudioContext error', err);
  }
}

export function speakText(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  window.speechSynthesis.speak(utterance);
}

