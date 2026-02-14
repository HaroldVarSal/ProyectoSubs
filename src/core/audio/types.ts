/**
 * ═══════════════════════════════════════════════════════════════
 * TIPOS Y ENUMERACIONES PARA EL PROYECTO DE AUDIO SUBLIMINAL
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Estados del ondas cerebrales según frecuencia (Hz)
 * Basado en investigación psicoacústica
 */
export const BrainwaveState = {
  DELTA: 'delta',       // 0.5-4 Hz  - Sueño profundo
  THETA: 'theta',       // 4-8 Hz    - Meditación profunda, creatividad
  ALPHA: 'alpha',       // 8-14 Hz   - Relajación, estado pre-sueño
  BETA: 'beta',         // 14-30 Hz  - Concentración, alerta
  GAMMA: 'gamma',       // 30-100 Hz - Procesamiento cognitivo alto
} as const;

export type BrainwaveState = typeof BrainwaveState[keyof typeof BrainwaveState];

/**
 * Configuración de frecuencias para cada estado cerebral
 */
export interface BrainwaveConfig {
  state: BrainwaveState;
  beatFrequency: number;      // Frecuencia del pulso binaural (Hz)
  carrierFrequency: number;   // Frecuencia portadora (Hz)
  description: string;
}

/**
 * Presets predefinidos para diferentes estados mentales
 */
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

/**
 * Tipos de ondas disponibles para osciladores
 */
export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

/**
 * Rango de frecuencias válidas
 */
export interface FrequencyRange {
  min: number;
  max: number;
}

/**
 * Constantes de validación de frecuencias
 */
export const FREQUENCY_LIMITS = {
  CARRIER: { min: 200, max: 1000 } as FrequencyRange,
  BEAT: { min: 0.5, max: 100 } as FrequencyRange,
  ISOCHRONIC: { min: 0.5, max: 40 } as FrequencyRange,
  SUBLIMINAL_CARRIER: 17500, // 17.5 kHz para mensajes subliminales
};

/**
 * Parámetros de volumen en diferentes escalas
 */
export interface VolumeParams {
  linear: number;    // 0.0 - 1.0
  decibels: number;  // -∞ a 0 dB
  percentage: number; // 0 - 100%
}

/**
 * Configuración de fade (entrada/salida gradual)
 */
export interface FadeConfig {
  duration: number;  // Duración en segundos
  type: 'linear' | 'exponential';
}

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
 * Errores personalizados para el motor de audio
 */
export class AudioEngineError extends Error {
  // Declaramos las propiedades fuera
  public code: string;
  public details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'AudioEngineError';
    // Asignamos manualmente los valores
    this.code = code;
    this.details = details;
  }
}

/**
 * Códigos de error
 */
export const ErrorCode = {
  INVALID_FREQUENCY: 'INVALID_FREQUENCY',
  INVALID_VOLUME: 'INVALID_VOLUME',
  CONTEXT_NOT_INITIALIZED: 'CONTEXT_NOT_INITIALIZED',
  PLAYBACK_ERROR: 'PLAYBACK_ERROR',
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];