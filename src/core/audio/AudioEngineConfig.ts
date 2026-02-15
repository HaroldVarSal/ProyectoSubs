/**
 * ═══════════════════════════════════════════════════════════════
 * CONFIGURACIÓN GLOBAL DE LOS MOTORES DE AUDIO
 * ═══════════════════════════════════════════════════════════════
 * 
 * Compatibilidad con TypeScript estricto (Vite 8):
 * ✅ Imports de tipo explícitos con 'type'
 * ✅ Sin enums
 */

import { type OscillatorType, type FadeConfig } from './types';

/**
 * CONFIGURACIÓN DEL MOTOR BINAURAL
 */
export const BINAURAL_CONFIG = {
  OSCILLATOR_TYPE: 'sine' as OscillatorType,
  INITIAL_VOLUME: 0.1,
  PAN_LEFT: -1,
  PAN_RIGHT: 1,
  
  FADE_IN: {
    duration: 0.05,
    type: 'linear',
  } as FadeConfig,

  FADE_OUT: {
    duration: 0.05,
    type: 'linear',
  } as FadeConfig,

  ASYNC_BUFFER_MS: 10,
  FREQUENCY_RAMP_TIME: 0.1,
};

/**
 * CONFIGURACIÓN DEL MOTOR ISOCRÓNICO
 */
export const ISOCHRONIC_CONFIG = {
  OSCILLATOR_TYPE: 'sine' as OscillatorType,
  LFO_TYPE: 'square' as OscillatorType,
  INITIAL_VOLUME: 0.15,
  MODULATION_DEPTH: 1.0,

  FADE_IN: {
    duration: 0.05,
    type: 'linear',
  } as FadeConfig,

  FADE_OUT: {
    duration: 0.05,
    type: 'linear',
  } as FadeConfig,
};

/**
 * CONFIGURACIÓN DEL MOTOR SUBLIMINAL
 */
export const SUBLIMINAL_CONFIG = {
  CARRIER_FREQUENCY: 17500,
  LFO_MIN: 0.1,
  LFO_MAX: 3.0,
  MESSAGE_VOLUME: 0.05,

  FADE_IN: {
    duration: 0.1,
    type: 'exponential',
  } as FadeConfig,

  FADE_OUT: {
    duration: 0.1,
    type: 'exponential',
  } as FadeConfig,
};

/**
 * CONFIGURACIÓN DEL MOTOR SUPRALIMINAL
 */
export const SUPRALIMINAL_CONFIG = {
  SPEED_FACTOR: 1.5,
  STEREO_LAYERS: 3,
  LAYER_PAN_POSITIONS: [-0.8, 0, 0.8],
  LAYER_TIME_OFFSET: 0.05,
  LAYER_VOLUME: 0.3,
};

/**
 * CONFIGURACIÓN GENERAL DEL AUDIO CONTEXT
 */
export const AUDIO_CONTEXT_CONFIG = {
  SAMPLE_RATE: 44100,
  LATENCY_HINT: 'interactive' as AudioContextLatencyCategory,
  RESUME_TIMEOUT: 1000,
};

/**
 * CONFIGURACIÓN DEL MEZCLADOR (MIXER)
 */
export const MIXER_CONFIG = {
  MAX_ENGINES: 4,
  MASTER_VOLUME: 0.8,
  AUTO_COMPRESSION: true,
  COMPRESSION_PRESET: 'MODERATE',
  BUFFER_SIZE: 2048,
  ENABLE_ANALYZER: false,
  FFT_SIZE: 2048,
};

/**
 * CONFIGURACIÓN DE GRABACIÓN
 */
export const RECORDER_CONFIG = {
  DEFAULT_FORMAT: 'wav' as 'wav' | 'mp3' | 'ogg',
  SAMPLE_RATE: 44100,
  CHANNELS: 2,
  BITRATE: 192,
  MAX_DURATION: 3600,
  BUFFER_SIZE: 4096,
};

/**
 * CONFIGURACIÓN DE OPTIMIZACIÓN DE CPU
 */
export const PERFORMANCE_CONFIG = {
  USE_AUDIO_WORKLETS: true,
  SHARED_CONTEXT: true,
  NODE_POOL_SIZE: 10,
  CLEANUP_INTERVAL: 30000,
  CPU_WARNING_THRESHOLD: 80,
  ENABLE_MONITORING: true,
};

/**
 * CONFIGURACIÓN DE DEBUGGING
 */
export const DEBUG_CONFIG = {
  ENABLE_LOGGING: true,
  LOG_LEVEL: 'info' as 'debug' | 'info' | 'warn' | 'error',
  SHOW_FREQUENCY_ANALYSIS: false,
};

/**
 * Helper: Convertir dB a ganancia lineal
 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Helper: Convertir ganancia lineal a dB
 */
export function gainToDb(gain: number): number {
  return 20 * Math.log10(gain || 0.0001);
}

/**
 * Helper: Convertir porcentaje a ganancia lineal con curva logarítmica
 */
export function percentageToGain(percentage: number): number {
  const clamped = Math.max(0, Math.min(100, percentage));
  return Math.pow(10, (clamped / 50) - 1);
}

/**
 * Helper: Convertir ganancia lineal a porcentaje
 */
export function gainToPercentage(gain: number): number {
  return 50 * (Math.log10(gain * 10));
}

/**
 * Helper: Crear configuración de compresión personalizada
 */
export function createCompressionConfig(
  intensity: 'subtle' | 'moderate' | 'aggressive' | 'limiter'
): { threshold: number; knee: number; ratio: number; attack: number; release: number } {
  const presets = {
    subtle: { threshold: -24, knee: 30, ratio: 4, attack: 0.003, release: 0.25 },
    moderate: { threshold: -18, knee: 20, ratio: 6, attack: 0.002, release: 0.2 },
    aggressive: { threshold: -12, knee: 10, ratio: 12, attack: 0.001, release: 0.1 },
    limiter: { threshold: -3, knee: 0, ratio: 20, attack: 0.001, release: 0.1 },
  };
  
  return presets[intensity];
}