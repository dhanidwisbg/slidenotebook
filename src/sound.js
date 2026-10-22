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

/**
 * Background Music (BGM) Controller
 */
class BgmPlayer {
  constructor() {
    this.audioElement = new Audio();
    this.audioElement.loop = true;
    this.synthInterval = null;
    this.isPlaying = false;
    this.isMuted = false;
    this.volume = 0.45;
    this.currentTrackType = 'none'; // 'custom', 'preset', 'none'
    this.currentPreset = 'none';
    this.customAudioUrl = null;
    this.audioElement.volume = this.volume;

    // Listen to user interaction to unlock autoplay
    this.hasUnlockedAutoplay = false;
    this.boundInteraction = this.handleFirstInteraction.bind(this);
    window.addEventListener('click', this.boundInteraction, { once: true });
    window.addEventListener('keydown', this.boundInteraction, { once: true });
    window.addEventListener('touchstart', this.boundInteraction, { once: true });
  }

  handleFirstInteraction() {
    this.hasUnlockedAutoplay = true;
    getAudioContext();
    if (this.isPlaying && this.currentTrackType === 'custom' && this.audioElement.paused) {
      this.audioElement.play().catch(() => {});
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    this.audioElement.volume = this.isMuted ? 0 : this.volume;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.audioElement.volume = this.isMuted ? 0 : this.volume;
    return this.isMuted;
  }

  setCustomAudio(blobOrUrl) {
    this.stopSynth();
    if (this.customAudioUrl && this.customAudioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.customAudioUrl);
    }

    if (blobOrUrl instanceof Blob) {
      this.customAudioUrl = URL.createObjectURL(blobOrUrl);
    } else {
      this.customAudioUrl = blobOrUrl;
    }

    this.currentTrackType = 'custom';
    this.audioElement.src = this.customAudioUrl;
    this.audioElement.load();
  }

  play() {
    this.isPlaying = true;
    getAudioContext();

    if (this.currentTrackType === 'custom' && this.customAudioUrl) {
      this.audioElement.play().catch((err) => {
        console.log('Autoplay deferred until user clicks:', err);
      });
    } else if (this.currentTrackType === 'preset') {
      this.startSynthPreset(this.currentPreset);
    }
  }

  pause() {
    this.isPlaying = false;
    this.audioElement.pause();
    this.stopSynth();
  }

  toggle() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
    return this.isPlaying;
  }

  loadPreset(presetName) {
    this.pause();
    this.currentPreset = presetName;

    if (presetName === 'none') {
      this.currentTrackType = 'none';
      return;
    }

    this.currentTrackType = 'preset';
    this.play();
  }

  stopSynth() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
  }

  startSynthPreset(presetName) {
    this.stopSynth();
    const ctx = getAudioContext();
    if (!ctx) return;

    // Calming procedural chord progression
    // Chords: Dmaj9 -> Bm7 -> Gmaj7 -> A6
    const chordFrequencies = [
      [146.83, 220.00, 277.18, 329.63, 440.00], // Dmaj9
      [123.47, 185.00, 220.00, 277.18, 369.99], // Bm7
      [98.00, 146.83, 196.00, 246.94, 293.66],  // Gmaj7
      [110.00, 164.81, 220.00, 277.18, 329.63]  // A6
    ];

    let chordIdx = 0;

    const playChordStep = () => {
      if (!this.isPlaying || this.isMuted || this.currentTrackType !== 'preset') return;

      const chord = chordFrequencies[chordIdx];
      chordIdx = (chordIdx + 1) % chordFrequencies.length;

      chord.forEach((freq, i) => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = i === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(700 + (presetName === 'lofi' ? 200 : 500), ctx.currentTime);

          const baseVolume = this.volume * 0.08;
          const stagger = i * 0.04;

          gain.gain.setValueAtTime(0.0001, ctx.currentTime + stagger);
          gain.gain.linearRampToValueAtTime(baseVolume, ctx.currentTime + stagger + 0.6);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + stagger + 3.8);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);

          osc.start(ctx.currentTime + stagger);
          osc.stop(ctx.currentTime + stagger + 4.0);
        } catch (e) {
          // ignore context state
        }
      });
    };

    playChordStep();
    this.synthInterval = setInterval(playChordStep, 3800);
  }
}

export const bgm = new BgmPlayer();
