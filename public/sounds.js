// CookedAI - Procedural Web Audio Sound Synthesizer
// Generates iconic sound effects directly in the browser with ZERO external audio dependencies!

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;

    // Requested meme audio tracks (one of three plays randomly after each roast)
    this.roastMemes = [
      { id: 'fah', name: 'FAHHHHHHHH', src: '/sounds/fah.mp3' },
      { id: 'thud', name: 'Instagram Thud', src: '/sounds/instagram_thud.mp3' },
      { id: 'gopgopgop', name: 'GOP GOP GOP', src: '/sounds/gopgopgop.mp3' }
    ];

    // Lazy / pre-cached Audio instances
    this.audioPool = [];
    if (typeof Audio !== 'undefined') {
      this.roastMemes.forEach(item => {
        try {
          const audio = new Audio(item.src);
          audio.preload = 'auto';
          this.audioPool.push({ ...item, audio });
        } catch (e) {
          console.warn('Audio preloading failed:', e);
        }
      });
    }
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // Plays 1 of the 3 requested meme sounds randomly
  playRandomRoastSound() {
    if (!this.enabled) return null;
    this.init();

    if (this.audioPool && this.audioPool.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.audioPool.length);
      const chosen = this.audioPool[randomIndex];
      try {
        chosen.audio.currentTime = 0;
        const promise = chosen.audio.play();
        if (promise !== undefined) {
          promise.catch(err => {
            console.warn('Playback error, using fallback boom:', err);
            this.playProceduralBoom();
          });
        }
        return chosen;
      } catch (err) {
        this.playProceduralBoom();
        return chosen;
      }
    } else {
      this.playProceduralBoom();
      return null;
    }
  }

  // Alias so existing triggers also invoke the 3-meme random roast sound
  playVineBoom() {
    return this.playRandomRoastSound();
  }

  // Procedural WebAudio Vine Boom (used as fallback or manual trigger)
  playProceduralBoom() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Sub oscillator for the deep thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.6);

    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.3);

    // Distortion/noise burst for the visceral crack
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.2);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noise.start(now);
  }

  // Bruh / Descending Low Saw Tone
  playBruh() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.45);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, now);
    filter.Q.value = 3.5;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.52);
  }

  // Emotional Damage / Critical Hit Glitch
  playDamage() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Quick two-tone sting
    [180, 110].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.4, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.22);
    });
  }

  // Crisp UI Click
  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }
}

window.soundFx = new SoundEngine();
