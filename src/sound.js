// Sound Manager
// Implements FR-17 (Page flip paper sound) and FR-11 (Background music player & synthesis)

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Synthesizes a realistic, tactile paper page-flip rustle sound
 */
export function playPageFlipSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Create noise buffer for paper texture
    const bufferSize = ctx.sampleRate * 0.18; // 180ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    // Filter to paper scrape/rustle frequencies
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.16);
    filter.Q.setValueAtTime(3.0, ctx.currentTime);

    // Gain envelope
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.17);

    // Low thump for spine binding flex
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.12);
    oscGain.gain.setValueAtTime(0.18, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

    whiteNoise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    whiteNoise.start(ctx.currentTime);
    osc.start(ctx.currentTime);

    whiteNoise.stop(ctx.currentTime + 0.18);
    osc.stop(ctx.currentTime + 0.18);
  } catch (err) {
    console.warn('Audio synthesis warning:', err);
  }
}
