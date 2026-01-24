import type { MusicNFT } from '@/hooks/useMusicNFTs';

const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

function extractIpfsHash(url: string): string | null {
  if (!url) return null;
  
  if (url.startsWith('Qm') || url.startsWith('bafy')) {
    return url;
  }
  
  const patterns = [
    /ipfs:\/\/(.+)/,
    /\/ipfs\/(.+)/,
    /gateway\.pinata\.cloud\/ipfs\/(.+)/,
    /ipfs\.io\/ipfs\/(.+)/,
    /cloudflare-ipfs\.com\/ipfs\/(.+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

export type RepeatMode = 'none' | 'one' | 'all';

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
}

type PlaybackCallback = (state: PlaybackState) => void;
type TrackEndCallback = () => void;

class CheeseAmpAudio {
  private audio: HTMLAudioElement;
  private currentTrack: MusicNFT | null = null;
  private callbacks: Set<PlaybackCallback> = new Set();
  private trackEndCallbacks: Set<TrackEndCallback> = new Set();
  private _volume: number = 0.8;
  private _isMuted: boolean = false;
  private _isLoading: boolean = false;
  private _error: string | null = null;
  private updateInterval: number | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.volume = this._volume;

    this.audio.addEventListener('play', () => this.notifyCallbacks());
    this.audio.addEventListener('pause', () => this.notifyCallbacks());
    this.audio.addEventListener('ended', () => {
      this.trackEndCallbacks.forEach(cb => cb());
      this.notifyCallbacks();
    });
    this.audio.addEventListener('loadstart', () => {
      this._isLoading = true;
      this.notifyCallbacks();
    });
    this.audio.addEventListener('canplay', () => {
      this._isLoading = false;
      this.notifyCallbacks();
    });
    this.audio.addEventListener('error', () => {
      this._error = 'Failed to load audio';
      this._isLoading = false;
      this.notifyCallbacks();
    });
    this.audio.addEventListener('durationchange', () => this.notifyCallbacks());

    // Start update interval for time updates
    this.updateInterval = window.setInterval(() => {
      if (!this.audio.paused) {
        this.notifyCallbacks();
      }
    }, 250);
  }

  private notifyCallbacks() {
    const state = this.getState();
    this.callbacks.forEach(cb => cb(state));
  }

  getState(): PlaybackState {
    return {
      isPlaying: !this.audio.paused,
      currentTime: this.audio.currentTime || 0,
      duration: this.audio.duration || 0,
      volume: this._volume,
      isMuted: this._isMuted,
      isLoading: this._isLoading,
      error: this._error,
    };
  }

  subscribe(callback: PlaybackCallback): () => void {
    this.callbacks.add(callback);
    callback(this.getState());
    return () => this.callbacks.delete(callback);
  }

  onTrackEnd(callback: TrackEndCallback): () => void {
    this.trackEndCallbacks.add(callback);
    return () => this.trackEndCallbacks.delete(callback);
  }

  async play(track: MusicNFT): Promise<void> {
    this._error = null;
    this._isLoading = true;
    this.currentTrack = track;
    this.notifyCallbacks();

    const audioUrl = track.audioUrl;
    
    // Check if it's already a full URL
    if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
      try {
        this.audio.src = audioUrl;
        await this.audio.play();
        return;
      } catch (e) {
        // If direct URL fails and it's an IPFS gateway URL, try other gateways
        const hash = extractIpfsHash(audioUrl);
        if (hash) {
          return this.tryGateways(hash);
        }
        throw e;
      }
    }

    // If it's an IPFS hash, try gateways
    const hash = extractIpfsHash(audioUrl);
    if (hash) {
      return this.tryGateways(hash);
    }

    throw new Error('Invalid audio URL');
  }

  private async tryGateways(hash: string): Promise<void> {
    for (const gateway of IPFS_GATEWAYS) {
      try {
        this.audio.src = `${gateway}${hash}`;
        await this.audio.play();
        this._isLoading = false;
        this.notifyCallbacks();
        return;
      } catch (e) {
        console.warn(`Gateway ${gateway} failed, trying next...`);
        continue;
      }
    }
    this._error = 'Failed to load audio from all gateways';
    this._isLoading = false;
    this.notifyCallbacks();
    throw new Error('Failed to load audio from all gateways');
  }

  resume(): void {
    if (this.audio.src) {
      this.audio.play().catch(console.error);
    }
  }

  pause(): void {
    this.audio.pause();
  }

  toggle(): void {
    if (this.audio.paused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  seek(time: number): void {
    if (this.audio.duration) {
      this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration));
      this.notifyCallbacks();
    }
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    this.audio.volume = this._isMuted ? 0 : this._volume;
    this.notifyCallbacks();
  }

  toggleMute(): void {
    this._isMuted = !this._isMuted;
    this.audio.volume = this._isMuted ? 0 : this._volume;
    this.notifyCallbacks();
  }

  getCurrentTrack(): MusicNFT | null {
    return this.currentTrack;
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.currentTrack = null;
    this.notifyCallbacks();
  }

  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.audio.pause();
    this.audio.src = '';
    this.callbacks.clear();
    this.trackEndCallbacks.clear();
  }
}

// Singleton instance
let audioInstance: CheeseAmpAudio | null = null;

export function getAudioPlayer(): CheeseAmpAudio {
  if (!audioInstance) {
    audioInstance = new CheeseAmpAudio();
  }
  return audioInstance;
}

export function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
