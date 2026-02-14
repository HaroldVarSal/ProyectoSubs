/**
 * ═══════════════════════════════════════════════════════════════
 * TIPOS Y ENUMERACIONES PARA EL PROYECTO DE AUDIO SUBLIMINAL
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Estados de ondas cerebrales
 */
export const BrainwaveState = {
  DELTA: 'delta',
  THETA: 'theta',
  ALPHA: 'alpha',
  BETA: 'beta',
  GAMMA: 'gamma',
} as const;
export type BrainwaveState = typeof BrainwaveState[keyof typeof BrainwaveState];

/**
 * Estado de reproducción del motor de audio
 */
export const PlaybackState = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  STOPPING: 'stopping',
} as const;
export type PlaybackState = typeof PlaybackState[keyof typeof PlaybackState];

/**
 * Códigos de error
 */
export const ErrorCode = {
  INVALID_FREQUENCY: 'INVALID_FREQUENCY',
  INVALID_VOLUME: 'INVALID_VOLUME',
  CONTEXT_NOT_INITIALIZED: 'CONTEXT_NOT_INITIALIZED',
  PLAYBACK_ERROR: 'PLAYBACK_ERROR',
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',
  FILE_LOAD_ERROR: 'FILE_LOAD_ERROR',
} as const;
export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Errores personalizados
 */
export class AudioEngineError extends Error {
  public code: string;
  public details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'AudioEngineError';
    this.code = code;
    this.details = details;
  }
}

// --- Interfaces de Configuración ---

export interface BrainwaveConfig {
  state: BrainwaveState;
  beatFrequency: number;
  carrierFrequency: number;
  description: string;
}

export const BRAINWAVE_PRESETS: Record<BrainwaveState, BrainwaveConfig> = {
  [BrainwaveState.DELTA]: {
    state: BrainwaveState.DELTA,
    beatFrequency: 2.5,
    carrierFrequency: 400,
    description: 'Sueño profundo y regeneración celular',
  },
  [BrainwaveState.THETA]: {
    state: BrainwaveState.THETA,
    beatFrequency: 6,
    carrierFrequency: 420,
    description: 'Meditación profunda y acceso al subconsciente',
  },
  [BrainwaveState.ALPHA]: {
    state: BrainwaveState.ALPHA,
    beatFrequency: 10,
    carrierFrequency: 440,
    description: 'Relajación consciente y aprendizaje',
  },
  [BrainwaveState.BETA]: {
    state: BrainwaveState.BETA,
    beatFrequency: 20,
    carrierFrequency: 450,
    description: 'Concentración y estado de alerta',
  },
  [BrainwaveState.GAMMA]: {
    state: BrainwaveState.GAMMA,
    beatFrequency: 40,
    carrierFrequency: 480,
    description: 'Procesamiento cognitivo superior',
  },
};

export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface FrequencyRange {
  min: number;
  max: number;
}

export const FREQUENCY_LIMITS = {
  CARRIER: { min: 200, max: 1000 } as FrequencyRange,
  BEAT: { min: 0.5, max: 100 } as FrequencyRange,
  ISOCHRONIC: { min: 0.5, max: 40 } as FrequencyRange,
  SUBLIMINAL_CARRIER: 17500,
};

export interface VolumeParams {
  linear: number;
  decibels: number;
  percentage: number;
}

export interface FadeConfig {
  duration: number;
  type: 'linear' | 'exponential';
}

// --- Nuevos tipos de Claude para SilentEngine v2.0 ---

export interface AMModulationConfig {
  carrierFrequency: number;
  lfoFrequency: number;
  lfoDepth: number; // 0.0 - 1.0
  messageGain: number; // Volumen del audio cargado
}

export interface AudioFileInfo {
  name: string;
  duration: number;
  sampleRate: number;
  channels: number;
}