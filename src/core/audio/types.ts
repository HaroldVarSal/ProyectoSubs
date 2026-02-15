/**
 * ═══════════════════════════════════════════════════════════════
 * TIPOS PARA EL PROYECTO DE AUDIO SUBLIMINAL
 * ═══════════════════════════════════════════════════════════════
 * 
 * Compatibilidad con TypeScript estricto (Vite 8):
 * ✅ Sin enums (no son borrables)
 * ✅ Objetos constantes con 'as const'
 * ✅ Sin parámetros de propiedad en constructores
 * ✅ Imports de tipo explícitos con 'type'
 */

/**
 * Estados de ondas cerebrales según frecuencia (Hz)
 */
export const BrainwaveState = {
  DELTA: 'delta',   // 0.5-4 Hz  - Sueño profundo
  THETA: 'theta',   // 4-8 Hz    - Meditación profunda, creatividad
  ALPHA: 'alpha',   // 8-14 Hz   - Relajación, estado pre-sueño
  BETA: 'beta',     // 14-30 Hz  - Concentración, alerta
  GAMMA: 'gamma',   // 30-100 Hz - Procesamiento cognitivo alto
} as const;

export type BrainwaveState = typeof BrainwaveState[keyof typeof BrainwaveState];

/**
 * Configuración de frecuencias para cada estado cerebral
 */
export interface BrainwaveConfig {
  state: BrainwaveState;
  beatFrequency: number;
  carrierFrequency: number;
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
  linear: number;
  decibels: number;
  percentage: number;
}

/**
 * Configuración de fade (entrada/salida gradual)
 */
export interface FadeConfig {
  duration: number;
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
 * Códigos de error
 */
export const ErrorCode = {
  INVALID_FREQUENCY: 'INVALID_FREQUENCY',
  INVALID_VOLUME: 'INVALID_VOLUME',
  CONTEXT_NOT_INITIALIZED: 'CONTEXT_NOT_INITIALIZED',
  PLAYBACK_ERROR: 'PLAYBACK_ERROR',
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',
  RECORDING_ERROR: 'RECORDING_ERROR',
  FILE_LOAD_ERROR: 'FILE_LOAD_ERROR',
  MODULATION_ERROR: 'MODULATION_ERROR',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Errores personalizados para el motor de audio
 * (Sin parámetros de propiedad en constructor)
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

/**
 * Tipos de motores de audio disponibles
 */
export const EngineType = {
  BINAURAL: 'binaural',
  ISOCHRONIC: 'isochronic',
  SILENT: 'silent',
  SUPRALIMINAL: 'supraliminal',
} as const;

export type EngineType = typeof EngineType[keyof typeof EngineType];

/**
 * Configuración para mezclar múltiples motores
 */
export interface MixerChannelConfig {
  engineType: EngineType;
  volume: number;
  enabled: boolean;
  solo: boolean;
  mute: boolean;
}

/**
 * Estado de grabación
 */
export const RecordingState = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PAUSED: 'paused',
  PROCESSING: 'processing',
} as const;

export type RecordingState = typeof RecordingState[keyof typeof RecordingState];

/**
 * Opciones de exportación de audio
 */
export interface ExportOptions {
  format: 'wav' | 'mp3' | 'ogg';
  bitrate?: number;
  sampleRate?: number;
  channels: 1 | 2;
}

/**
 * Resultado de exportación
 */
export interface ExportResult {
  blob: Blob;
  url: string;
  duration: number;
  size: number;
  format: string;
}

/**
 * Configuración de modulación de amplitud (AM)
 */
export interface AMModulationConfig {
  modulationDepth: number;
  carrierFrequency: number;
  messageGain: number;
}

/**
 * Información de archivo de audio cargado
 */
export interface AudioFileInfo {
  name: string;
  duration: number;
  sampleRate: number;
  channels: number;
  size: number;
  format: string;
}

/**
 * Configuración de compresión dinámica
 */
export interface CompressionConfig {
  threshold: number;
  knee: number;
  ratio: number;
  attack: number;
  release: number;
}

/**
 * Preset de compresión predefinidos
 */
export const COMPRESSION_PRESETS = {
  SUBTLE: {
    threshold: -24,
    knee: 30,
    ratio: 4,
    attack: 0.003,
    release: 0.25,
  } as CompressionConfig,
  
  MODERATE: {
    threshold: -18,
    knee: 20,
    ratio: 6,
    attack: 0.002,
    release: 0.2,
  } as CompressionConfig,
  
  AGGRESSIVE: {
    threshold: -12,
    knee: 10,
    ratio: 12,
    attack: 0.001,
    release: 0.1,
  } as CompressionConfig,
  
  LIMITER: {
    threshold: -3,
    knee: 0,
    ratio: 20,
    attack: 0.001,
    release: 0.1,
  } as CompressionConfig,
};

/**
 * Métricas de rendimiento del sistema de audio
 */
export interface AudioPerformanceMetrics {
  cpuUsage: number;
  latency: number;
  bufferSize: number;
  activeNodes: number;
  droppedFrames: number;
}