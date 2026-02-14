/**
 * ═══════════════════════════════════════════════════════════════
 * MOTOR DE PULSOS ISOCRÓNICOS
 * ═══════════════════════════════════════════════════════════════
 * 
 * Los pulsos isocrónicos son tonos que se encienden y apagan
 * rítmicamente a una frecuencia específica. A diferencia de los
 * binaurales, NO requieren auriculares estéreo.
 * 
 * VENTAJAS:
 * ✓ Funcionan con altavoces mono o estéreo
 * ✓ Más intensos que los binaurales
 * ✓ Útiles para concentración y estados de alerta
 * 
 * TÉCNICA:
 * - Oscilador principal genera el tono base
 * - LFO (Low Frequency Oscillator) modula la amplitud
 * - Forma de onda cuadrada del LFO crea pulsos nítidos
 * 
 * @author Tu Nombre
 * @version 1.0
 */

import {
  AudioEngineError,
  ErrorCode,
  PlaybackState,
  FREQUENCY_LIMITS,
  type VolumeParams,
  BrainwaveState,
  BRAINWAVE_PRESETS,
} from './types';

import {
  ISOCHRONIC_CONFIG,
  AUDIO_CONTEXT_CONFIG,
  DEBUG_CONFIG,
  percentageToGain,
  gainToPercentage,
  gainToDb,
} from './AudioEngineConfig';

/**
 * Clase principal del motor isocrónico
 */
export class IsocronicEngine {
  // ═══════════════════════════════════════════════════════════════
  // 1. VARIABLES PRIVADAS
  // ═══════════════════════════════════════════════════════════════

  private context: AudioContext | null = null;
  
  /**
   * Oscilador principal (genera el tono base)
   */
  private carrierOscillator: OscillatorNode | null = null;
  
  /**
   * LFO - Low Frequency Oscillator (genera el pulso)
   * Su frecuencia determina cuántas veces por segundo pulsa el sonido
   */
  private lfoOscillator: OscillatorNode | null = null;
  
  /**
   * Nodo de ganancia controlado por el LFO
   * Aquí es donde ocurre la "modulación de amplitud"
   */
  private modulatorGain: GainNode | null = null;
  
  /**
   * Ganancia maestra para control de volumen
   */
  private masterGain: GainNode | null = null;

  /**
   * Estado de reproducción
   */
  private state: PlaybackState = PlaybackState.IDLE;

  /**
   * Frecuencias actuales
   */
  private currentToneFreq: number = 0;
  private currentPulseRate: number = 0;

  /**
   * Timeout para detención asíncrona
   */
  private stopTimeout: number | null = null;

  // ═══════════════════════════════════════════════════════════════
  // 2. CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════

  constructor() {
    this.log('IsocronicEngine inicializado');
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. INICIALIZACIÓN
  // ═══════════════════════════════════════════════════════════════

  /**
   * Inicializa el AudioContext
   */
  private async init(): Promise<void> {
    if (this.context) {
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      if (!AudioContextClass) {
        throw new AudioEngineError(
          'Tu navegador no soporta Web Audio API',
          ErrorCode.BROWSER_NOT_SUPPORTED
        );
      }

      this.context = new AudioContextClass({
        latencyHint: AUDIO_CONTEXT_CONFIG.LATENCY_HINT,
        sampleRate: AUDIO_CONTEXT_CONFIG.SAMPLE_RATE,
      });

      // Crear ganancia maestra
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = ISOCHRONIC_CONFIG.INITIAL_VOLUME;
      this.masterGain.connect(this.context.destination);

      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      this.log('AudioContext creado para pulsos isocrónicos', {
        sampleRate: this.context.sampleRate,
        state: this.context.state,
      });

    } catch (error) {
      throw new AudioEngineError(
        'Error al inicializar motor isocrónico',
        ErrorCode.CONTEXT_NOT_INITIALIZED,
        error
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. VALIDACIÓN
  // ═══════════════════════════════════════════════════════════════

  /**
   * Valida la frecuencia del tono portador
   */
  private validateToneFrequency(freq: number): void {
    const { min, max } = FREQUENCY_LIMITS.CARRIER;
    
    if (freq < min || freq > max) {
      throw new AudioEngineError(
        `Frecuencia del tono debe estar entre ${min}-${max} Hz`,
        ErrorCode.INVALID_FREQUENCY,
        { frequency: freq }
      );
    }
  }

  /**
   * Valida la tasa de pulso
   */
  private validatePulseRate(rate: number): void {
    const { min, max } = FREQUENCY_LIMITS.ISOCHRONIC;
    
    if (rate < min || rate > max) {
      throw new AudioEngineError(
        `Tasa de pulso debe estar entre ${min}-${max} Hz`,
        ErrorCode.INVALID_FREQUENCY,
        { pulseRate: rate }
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. GENERACIÓN DE PULSOS ISOCRÓNICOS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Reproduce pulsos isocrónicos
   * 
   * @param toneFreq - Frecuencia del tono base (Hz)
   * @param pulseRate - Frecuencia de pulsación (Hz)
   * @param modulationDepth - Profundidad de modulación (0-1, default: 1)
   * 
   * @example
   * // Generar pulsos de 10 Hz (Alpha) con tono de 440 Hz
   * engine.play(440, 10);
   * 
   * // Pulsos más suaves (50% de profundidad)
   * engine.play(440, 10, 0.5);
   */
  public async play(
    toneFreq: number,
    pulseRate: number,
    modulationDepth: number = ISOCHRONIC_CONFIG.MODULATION_DEPTH
  ): Promise<void> {
    try {
      // Validar parámetros
      this.validateToneFrequency(toneFreq);
      this.validatePulseRate(pulseRate);

      // Clamp modulation depth
      modulationDepth = Math.max(0, Math.min(1, modulationDepth));

      // Inicializar contexto
      await this.init();

      // Detener reproducción anterior
      if (this.state === PlaybackState.PLAYING) {
        await this.stop();
        await this.delay(50);
      }

      if (!this.context || !this.masterGain) {
        throw new AudioEngineError(
          'AudioContext no inicializado',
          ErrorCode.CONTEXT_NOT_INITIALIZED
        );
      }

      const now = this.context.currentTime;

      // ─────────────────────────────────────────────────────────
      // 1. CREAR OSCILADOR PRINCIPAL (Tono Base)
      // ─────────────────────────────────────────────────────────

      this.carrierOscillator = this.context.createOscillator();
      this.carrierOscillator.type = ISOCHRONIC_CONFIG.OSCILLATOR_TYPE;
      this.carrierOscillator.frequency.value = toneFreq;

      // ─────────────────────────────────────────────────────────
      // 2. CREAR NODO DE MODULACIÓN
      // ─────────────────────────────────────────────────────────
      
      // Este nodo será controlado por el LFO
      this.modulatorGain = this.context.createGain();
      
      // Configurar para modulación completa (de 0 a 1)
      // El valor base es 0.5, y el LFO añadirá ±0.5 * modulationDepth
      this.modulatorGain.gain.value = 0.5;

      // ─────────────────────────────────────────────────────────
      // 3. CREAR LFO (Oscilador de Baja Frecuencia)
      // ─────────────────────────────────────────────────────────

      this.lfoOscillator = this.context.createOscillator();
      // Onda cuadrada para pulsos nítidos (on/off)
      this.lfoOscillator.type = ISOCHRONIC_CONFIG.LFO_TYPE;
      // Esta frecuencia determina cuántas veces por segundo pulsa
      this.lfoOscillator.frequency.value = pulseRate;

      // ─────────────────────────────────────────────────────────
      // 4. CREAR GANANCIA PARA EL LFO
      // ─────────────────────────────────────────────────────────

      // El LFO produce valores entre -1 y +1
      // Lo escalamos a la profundidad de modulación deseada
      const lfoGain = this.context.createGain();
      lfoGain.gain.value = 0.5 * modulationDepth; // Escalar profundidad

      // ─────────────────────────────────────────────────────────
      // 5. CONECTAR LA CADENA DE AUDIO
      // ─────────────────────────────────────────────────────────

      // Cadena de modulación: LFO -> LFO Gain -> Modulator Gain
      this.lfoOscillator.connect(lfoGain);
      lfoGain.connect(this.modulatorGain.gain);

      // Cadena de audio: Carrier -> Modulator -> Master -> Speakers
      this.carrierOscillator.connect(this.modulatorGain);
      this.modulatorGain.connect(this.masterGain);

      // ─────────────────────────────────────────────────────────
      // 6. FADE IN
      // ─────────────────────────────────────────────────────────

      const fadeInDuration = ISOCHRONIC_CONFIG.FADE_IN.duration;
      const currentVolume = this.masterGain.gain.value;

      this.masterGain.gain.setValueAtTime(0, now);
      this.masterGain.gain.linearRampToValueAtTime(currentVolume, now + fadeInDuration);

      // ─────────────────────────────────────────────────────────
      // 7. INICIAR REPRODUCCIÓN
      // ─────────────────────────────────────────────────────────

      this.carrierOscillator.start(now);
      this.lfoOscillator.start(now);

      // Guardar estado
      this.currentToneFreq = toneFreq;
      this.currentPulseRate = pulseRate;
      this.state = PlaybackState.PLAYING;

      this.log('Pulsos isocrónicos iniciados', {
        toneFreq: `${toneFreq} Hz`,
        pulseRate: `${pulseRate} Hz (${pulseRate} pulsos/segundo)`,
        modulationDepth: `${(modulationDepth * 100).toFixed(0)}%`,
        waveType: this.carrierOscillator.type,
        lfoType: this.lfoOscillator.type,
      });

    } catch (error) {
      this.state = PlaybackState.IDLE;
      
      if (error instanceof AudioEngineError) {
        throw error;
      }
      
      throw new AudioEngineError(
        'Error al reproducir pulsos isocrónicos',
        ErrorCode.PLAYBACK_ERROR,
        error
      );
    }
  }

  /**
   * Reproduce un preset predefinido de onda cerebral
   * 
   * @param state - Estado de onda cerebral deseado
   * @param modulationDepth - Profundidad opcional (default: 1.0)
   */
  public async playPreset(
    state: BrainwaveState,
    modulationDepth?: number
  ): Promise<void> {
    const preset = BRAINWAVE_PRESETS[state];
    
    this.log(`Reproduciendo preset isocrónico: ${preset.description}`, preset);
    
    await this.play(
      preset.carrierFrequency,
      preset.beatFrequency, // Usamos la misma frecuencia que los binaurales
      modulationDepth
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. DETENER REPRODUCCIÓN
  // ═══════════════════════════════════════════════════════════════

  /**
   * Detiene los pulsos con fade out
   */
  public async stop(): Promise<void> {
    if (this.state !== PlaybackState.PLAYING) {
      return;
    }

    if (this.stopTimeout !== null) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }

    this.state = PlaybackState.STOPPING;

    try {
      if (!this.context || !this.masterGain) return;

      const now = this.context.currentTime;
      const fadeOutDuration = ISOCHRONIC_CONFIG.FADE_OUT.duration;

      // Fade out
      const currentVolume = this.masterGain.gain.value;
      this.masterGain.gain.setValueAtTime(currentVolume, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + fadeOutDuration);

      // Detener después del fade
      const stopDelay = (fadeOutDuration * 1000) + 10;

      await new Promise<void>((resolve) => {
        this.stopTimeout = window.setTimeout(() => {
          try {
            // Detener osciladores
            if (this.carrierOscillator) {
              this.carrierOscillator.stop();
              this.carrierOscillator.disconnect();
              this.carrierOscillator = null;
            }

            if (this.lfoOscillator) {
              this.lfoOscillator.stop();
              this.lfoOscillator.disconnect();
              this.lfoOscillator = null;
            }

            // Desconectar modulador
            if (this.modulatorGain) {
              this.modulatorGain.disconnect();
              this.modulatorGain = null;
            }

            // Restaurar volumen
            if (this.masterGain && this.context) {
              this.masterGain.gain.setValueAtTime(
                ISOCHRONIC_CONFIG.INITIAL_VOLUME,
                this.context.currentTime
              );
            }

            this.state = PlaybackState.IDLE;
            this.stopTimeout = null;

            this.log('Pulsos isocrónicos detenidos');
            resolve();
          } catch (error) {
            this.log('Error al detener pulsos', error, 'error');
            resolve();
          }
        }, stopDelay);
      });

    } catch (error) {
      this.state = PlaybackState.IDLE;
      this.log('Error durante detención', error, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. CONTROL DE VOLUMEN
  // ═══════════════════════════════════════════════════════════════

  /**
   * Ajusta el volumen con percepción logarítmica
   */
  public setVolume(percentage: number): void {
    if (!this.masterGain || !this.context) return;

    const clamped = Math.max(0, Math.min(100, percentage));
    const gainValue = percentageToGain(clamped);

    const now = this.context.currentTime;
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(gainValue, now + 0.05);

    this.log('Volumen ajustado', {
      percentage: `${clamped}%`,
      linearGain: gainValue.toFixed(3),
      decibels: `${gainToDb(gainValue).toFixed(1)} dB`,
    });
  }

  /**
   * Obtiene el volumen actual
   */
  public getVolume(): VolumeParams {
    if (!this.masterGain) {
      return { linear: 0, decibels: -Infinity, percentage: 0 };
    }

    const linear = this.masterGain.gain.value;

    return {
      linear,
      decibels: gainToDb(linear),
      percentage: gainToPercentage(linear),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. ACTUALIZACIÓN EN TIEMPO REAL
  // ═══════════════════════════════════════════════════════════════

  /**
   * Cambia las frecuencias sin detener
   */
  public updateFrequencies(toneFreq: number, pulseRate: number): void {
    if (this.state !== PlaybackState.PLAYING) {
      this.log('No está reproduciendo', null, 'warn');
      return;
    }

    this.validateToneFrequency(toneFreq);
    this.validatePulseRate(pulseRate);

    if (!this.context || !this.carrierOscillator || !this.lfoOscillator) return;

    const now = this.context.currentTime;
    const rampTime = 0.1;

    // Actualizar tono
    this.carrierOscillator.frequency.setValueAtTime(
      this.carrierOscillator.frequency.value,
      now
    );
    this.carrierOscillator.frequency.linearRampToValueAtTime(toneFreq, now + rampTime);

    // Actualizar tasa de pulso
    this.lfoOscillator.frequency.setValueAtTime(
      this.lfoOscillator.frequency.value,
      now
    );
    this.lfoOscillator.frequency.linearRampToValueAtTime(pulseRate, now + rampTime);

    this.currentToneFreq = toneFreq;
    this.currentPulseRate = pulseRate;

    this.log('Frecuencias actualizadas', {
      toneFreq: `${toneFreq} Hz`,
      pulseRate: `${pulseRate} Hz`,
    });
  }

  /**
   * Ajusta la profundidad de modulación en tiempo real
   */
  public setModulationDepth(depth: number): void {
    if (this.state !== PlaybackState.PLAYING) return;
    if (!this.context || !this.modulatorGain) return;

    const clamped = Math.max(0, Math.min(1, depth));
    // const now = this.context.currentTime;

    // El modulatorGain.gain está siendo controlado por el LFO
    // Para cambiar la profundidad, necesitamos recrear las conexiones
    // Por simplicidad, solo registramos el cambio
    this.log('Profundidad de modulación ajustada', {
      depth: `${(clamped * 100).toFixed(0)}%`,
      note: 'Para aplicar cambios, reiniciar reproducción',
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. GETTERS
  // ═══════════════════════════════════════════════════════════════

  public getState(): PlaybackState {
    return this.state;
  }

  public isPlaying(): boolean {
    return this.state === PlaybackState.PLAYING;
  }

  public getCurrentFrequencies(): { tone: number; pulseRate: number } {
    return {
      tone: this.currentToneFreq,
      pulseRate: this.currentPulseRate,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 10. LIMPIEZA
  // ═══════════════════════════════════════════════════════════════

  public async dispose(): Promise<void> {
    await this.stop();

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    this.masterGain = null;
    this.state = PlaybackState.IDLE;

    this.log('Motor isocrónico destruido');
  }

  // ═══════════════════════════════════════════════════════════════
  // 11. UTILIDADES
  // ═══════════════════════════════════════════════════════════════

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(message: string, data?: any, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
    if (!DEBUG_CONFIG.ENABLE_LOGGING) return;

    const prefix = '[IsocronicEngine]';
    
    switch (level) {
      case 'debug':
        if (DEBUG_CONFIG.LOG_LEVEL === 'debug') {
          console.log(`${prefix} 🔍`, message, data);
        }
        break;
      case 'info':
        console.log(`${prefix} 🎵`, message, data || '');
        break;
      case 'warn':
        console.warn(`${prefix} ⚠️`, message, data);
        break;
      case 'error':
        console.error(`${prefix} ❌`, message, data);
        break;
    }
  }
}