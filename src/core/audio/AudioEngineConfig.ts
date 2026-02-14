/**
 * ═══════════════════════════════════════════════════════════════
 * CONFIGURACIÓN GLOBAL DE LOS MOTORES DE AUDIO
 * ═══════════════════════════════════════════════════════════════
 * 
 * Este archivo centraliza todas las constantes y configuraciones
 * usadas por los diferentes motores de audio del proyecto.
 */

import { type OscillatorType, type FadeConfig } from './types';

/**
 * CONFIGURACIÓN DEL MOTOR BINAURAL
 */
export const BINAURAL_CONFIG = {
  /**
   * Tipo de onda a usar (senoidal para máxima pureza)
   * Según el PDF: debe ser onda senoidal pura sin armónicos
   */
  OSCILLATOR_TYPE: 'sine' as OscillatorType,

  /**
   * Volumen inicial en escala lineal
   * -20dB ≈ 0.1 en escala lineal
   */
  INITIAL_VOLUME: 0.1,

  /**
   * Posición panorámica (stereo)
   * -1 = 100% izquierda, +1 = 100% derecha
   */
  PAN_LEFT: -1,
  PAN_RIGHT: 1,

  /**
   * Configuración de fade in/out
   */
  FADE_IN: {
    duration: 0.05, // 50ms
    type: 'linear',
  } as FadeConfig,

  FADE_OUT: {
    duration: 0.05, // 50ms
    type: 'linear',
  } as FadeConfig,

  /**
   * Buffer de seguridad para operaciones asíncronas (ms)
   */
  ASYNC_BUFFER_MS: 10,

  /**
   * Tiempo de rampa para cambios de frecuencia en tiempo real (s)
   */
  FREQUENCY_RAMP_TIME: 0.1,
};

/**
 * CONFIGURACIÓN DEL MOTOR ISOCRÓNICO
 */
export const ISOCHRONIC_CONFIG = {
  /**
   * Tipo de onda del pulso
   */
  OSCILLATOR_TYPE: 'sine' as OscillatorType,

  /**
   * Tipo de onda del LFO (modulador)
   * 'square' crea pulsos on/off nítidos
   */
  LFO_TYPE: 'square' as OscillatorType,

  /**
   * Volumen inicial
   */
  INITIAL_VOLUME: 0.15,

  /**
   * Profundidad de modulación (0-1)
   * 1.0 = modulación completa (de 0% a 100%)
   */
  MODULATION_DEPTH: 1.0,

  /**
   * Fade suave para evitar clicks
   */
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
  /**
   * Frecuencia portadora ultrasónica (17.5 kHz)
   * Esta frecuencia está por encima del rango audible consciente
   */
  CARRIER_FREQUENCY: 17500,

  /**
   * Rango de variación del LFO (Hz)
   * Para evitar habituación neural según el PDF
   */
  LFO_MIN: 0.1,
  LFO_MAX: 3.0,

  /**
   * Volumen del mensaje subliminal
   * Debe ser muy bajo para que permanezca inconsciente
   */
  MESSAGE_VOLUME: 0.05,

  /**
   * Configuración de fade
   */
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
  /**
   * Factor de aceleración temporal
   * 1.5 = 50% más rápido (recomendado en el PDF)
   */
  SPEED_FACTOR: 1.5,

  /**
   * Número de capas estereofónicas simultáneas
   * Para saturar el ancho de banda consciente
   */
  STEREO_LAYERS: 3,

  /**
   * Separación panorámica entre capas (-1 a 1)
   */
  LAYER_PAN_POSITIONS: [-0.8, 0, 0.8],

  /**
   * Desfase temporal entre capas (segundos)
   */
  LAYER_TIME_OFFSET: 0.05,

  /**
   * Volumen por capa
   */
  LAYER_VOLUME: 0.3,
};

/**
 * CONFIGURACIÓN GENERAL DEL AUDIO CONTEXT
 */
export const AUDIO_CONTEXT_CONFIG = {
  /**
   * Sample rate preferido (Hz)
   * 44100 = calidad CD estándar
   */
  SAMPLE_RATE: 44100,

  /**
   * Latencia preferida (segundos)
   * 'interactive' = baja latencia para respuesta inmediata
   */
  LATENCY_HINT: 'interactive' as AudioContextLatencyCategory,

  /**
   * Timeout para resumir contexto suspendido (ms)
   */
  RESUME_TIMEOUT: 1000,
};

/**
 * CONFIGURACIÓN DE DEBUGGING
 */
export const DEBUG_CONFIG = {
  /**
   * Habilitar logs en consola
   */
  ENABLE_LOGGING: true,

  /**
   * Nivel de detalle de logs
   */
  LOG_LEVEL: 'info' as 'debug' | 'info' | 'warn' | 'error',

  /**
   * Mostrar análisis de frecuencias en tiempo real
   */
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
 * El oído humano percibe el volumen logarítmicamente
 */
export function percentageToGain(percentage: number): number {
  // Clamp entre 0-100
  const clamped = Math.max(0, Math.min(100, percentage));
  
  // Curva logarítmica: y = 10^(x/50) / 10
  // Esto hace que 50% suene como "mitad de volumen" al oído humano
  return Math.pow(10, (clamped / 50) - 1);
}

/**
 * Helper: Convertir ganancia lineal a porcentaje
 */
export function gainToPercentage(gain: number): number {
  // Invertir la fórmula logarítmica
  return 50 * (Math.log10(gain * 10));
}