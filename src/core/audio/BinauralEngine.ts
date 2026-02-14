/**
 * ═══════════════════════════════════════════════════════════════
 * MOTOR DE PULSOS BINAURALES - VERSIÓN MEJORADA
 * ═══════════════════════════════════════════════════════════════
 * 
 * Este motor genera pulsos binaurales de alta fidelidad para
 * inducir estados específicos de ondas cerebrales mediante
 * el arrastre de frecuencias (brainwave entrainment).
 * 
 * MEJORAS IMPLEMENTADAS:
 * ✓ Control de volumen logarítmico (percepción natural)
 * ✓ Fade in/out para eliminar clicks audibles
 * ✓ Validación robusta de parámetros
 * ✓ Cambio de frecuencias en tiempo real
 * ✓ Manejo de suspensión del AudioContext
 * ✓ Sistema de errores personalizado
 * ✓ Logs para debugging
 * 
 * @author Tu Nombre
 * @version 2.0
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
  BINAURAL_CONFIG,
  AUDIO_CONTEXT_CONFIG,
  DEBUG_CONFIG,
  percentageToGain,
  gainToPercentage,
  gainToDb,
} from './AudioEngineConfig';

/**
 * Clase principal del motor binaural
 */
export class BinauralEngine {
  // ═══════════════════════════════════════════════════════════════
  // 1. VARIABLES PRIVADAS (El laboratorio interno)
  // ═══════════════════════════════════════════════════════════════

  private context: AudioContext | null = null;
  private leftOscillator: OscillatorNode | null = null;
  private rightOscillator: OscillatorNode | null = null;
  private leftPanner: StereoPannerNode | null = null;
  private rightPanner: StereoPannerNode | null = null;
  private masterGain: GainNode | null = null;
  
  /**
   * Estado actual de reproducción
   */
  private state: PlaybackState = PlaybackState.IDLE;

  /**
   * Frecuencias actuales (para cambios en tiempo real)
   */
  private currentCarrierFreq: number = 0;
  private currentBeatFreq: number = 0;

  /**
   * Timeout para operaciones asíncronas
   */
  private stopTimeout: number | null = null;

  // ═══════════════════════════════════════════════════════════════
  // 2. CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════

  constructor() {
    this.log('BinauralEngine inicializado (aún sin AudioContext)');
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. INICIALIZACIÓN DEL AUDIO CONTEXT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Inicializa el AudioContext y nodos de audio
   * Se llama automáticamente al hacer play()
   * 
   * @throws {AudioEngineError} Si el navegador no soporta Web Audio API
   */
  private async init(): Promise<void> {
    // Si ya existe, no recrear
    if (this.context) {
      // Verificar si está suspendido y reanudar
      if (this.context.state === 'suspended') {
        await this.resumeContext();
      }
      return;
    }

    try {
      // Crear el AudioContext con configuración optimizada
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

      // Crear el nodo de ganancia maestro
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = BINAURAL_CONFIG.INITIAL_VOLUME;
      
      // Conectar al destino final (altavoces)
      this.masterGain.connect(this.context.destination);

      // Si el contexto se crea suspendido, intentar reanudarlo
      if (this.context.state === 'suspended') {
        await this.resumeContext();
      }

      this.log('AudioContext creado exitosamente', {
        sampleRate: this.context.sampleRate,
        state: this.context.state,
        latency: this.context.baseLatency,
      });

    } catch (error) {
      throw new AudioEngineError(
        'Error al inicializar el motor de audio',
        ErrorCode.CONTEXT_NOT_INITIALIZED,
        error
      );
    }
  }

  /**
   * Intenta reanudar un AudioContext suspendido
   * Los navegadores suspenden el audio para ahorrar recursos
   */
  private async resumeContext(): Promise<void> {
    if (!this.context || this.context.state !== 'suspended') return;

    try {
      await this.context.resume();
      this.log('AudioContext reanudado desde suspensión');
    } catch (error) {
      this.log('Error al reanudar AudioContext', error, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. VALIDACIÓN DE PARÁMETROS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Valida que la frecuencia portadora esté en rango seguro
   * 
   * @param freq - Frecuencia en Hz
   * @throws {AudioEngineError} Si está fuera de rango
   */
  private validateCarrierFrequency(freq: number): void {
    const { min, max } = FREQUENCY_LIMITS.CARRIER;
    
    if (freq < min || freq > max) {
      throw new AudioEngineError(
        `Frecuencia portadora debe estar entre ${min}-${max} Hz (recibido: ${freq} Hz)`,
        ErrorCode.INVALID_FREQUENCY,
        { frequency: freq, limits: FREQUENCY_LIMITS.CARRIER }
      );
    }
  }

  /**
   * Valida que la frecuencia de pulso binaural esté en rango seguro
   * 
   * @param freq - Frecuencia en Hz
   * @throws {AudioEngineError} Si está fuera de rango
   */
  private validateBeatFrequency(freq: number): void {
    const { min, max } = FREQUENCY_LIMITS.BEAT;
    
    if (freq < min || freq > max) {
      throw new AudioEngineError(
        `Frecuencia de pulso debe estar entre ${min}-${max} Hz (recibido: ${freq} Hz)`,
        ErrorCode.INVALID_FREQUENCY,
        { frequency: freq, limits: FREQUENCY_LIMITS.BEAT }
      );
    }
  }

  /**
   * Valida que el volumen esté en rango válido
   * 
   * @param volume - Volumen lineal (0-1)
   * @throws {AudioEngineError} Si está fuera de rango
   */
  private validateVolume(volume: number): void {
    if (volume < 0 || volume > 1) {
      throw new AudioEngineError(
        `Volumen debe estar entre 0 y 1 (recibido: ${volume})`,
        ErrorCode.INVALID_VOLUME,
        { volume }
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. GENERACIÓN DE PULSOS BINAURALES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Reproduce un pulso binaural con las frecuencias especificadas
   * 
   * @param carrierFreq - Frecuencia base en Hz (200-1000 Hz)
   * @param beatFreq - Diferencia de frecuencia en Hz (0.5-100 Hz)
   * 
   * @example
   * // Generar ondas Alpha (10 Hz) para relajación
   * engine.play(440, 10);
   * 
   * // Generar ondas Theta (6 Hz) para meditación
   * engine.play(420, 6);
   * 
   * @throws {AudioEngineError} Si los parámetros son inválidos
   */
  public async play(carrierFreq: number, beatFreq: number): Promise<void> {
    try {
      // Validar parámetros antes de proceder
      this.validateCarrierFrequency(carrierFreq);
      this.validateBeatFrequency(beatFreq);

      // Asegurar que el AudioContext esté listo
      await this.init();

      // Si ya está reproduciendo, detener primero
      if (this.state === PlaybackState.PLAYING) {
        await this.stop();
        // Pequeña espera para asegurar limpieza completa
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
      // CANAL IZQUIERDO (Frecuencia base)
      // ─────────────────────────────────────────────────────────

      this.leftOscillator = this.context.createOscillator();
      this.leftOscillator.type = BINAURAL_CONFIG.OSCILLATOR_TYPE;
      this.leftOscillator.frequency.value = carrierFreq;

      this.leftPanner = this.context.createStereoPanner();
      this.leftPanner.pan.value = BINAURAL_CONFIG.PAN_LEFT;

      // Conectar: Oscilador -> Panner -> Ganancia Maestra
      this.leftOscillator.connect(this.leftPanner);
      this.leftPanner.connect(this.masterGain);

      // ─────────────────────────────────────────────────────────
      // CANAL DERECHO (Frecuencia base + diferencia)
      // ─────────────────────────────────────────────────────────

      this.rightOscillator = this.context.createOscillator();
      this.rightOscillator.type = BINAURAL_CONFIG.OSCILLATOR_TYPE;
      // ¡AQUÍ ESTÁ LA MAGIA BINAURAL!
      this.rightOscillator.frequency.value = carrierFreq + beatFreq;

      this.rightPanner = this.context.createStereoPanner();
      this.rightPanner.pan.value = BINAURAL_CONFIG.PAN_RIGHT;

      // Conectar: Oscilador -> Panner -> Ganancia Maestra
      this.rightOscillator.connect(this.rightPanner);
      this.rightPanner.connect(this.masterGain);

      // ─────────────────────────────────────────────────────────
      // FADE IN (para eliminar clicks al inicio)
      // ─────────────────────────────────────────────────────────

      const fadeInDuration = BINAURAL_CONFIG.FADE_IN.duration;
      const currentVolume = this.masterGain.gain.value;

      // Empezar desde silencio
      this.masterGain.gain.setValueAtTime(0, now);
      // Subir gradualmente al volumen actual
      this.masterGain.gain.linearRampToValueAtTime(
        currentVolume,
        now + fadeInDuration
      );

      // ─────────────────────────────────────────────────────────
      // INICIAR REPRODUCCIÓN
      // ─────────────────────────────────────────────────────────

      this.leftOscillator.start(now);
      this.rightOscillator.start(now);

      // Guardar estado actual
      this.currentCarrierFreq = carrierFreq;
      this.currentBeatFreq = beatFreq;
      this.state = PlaybackState.PLAYING;

      this.log('Pulso binaural iniciado', {
        carrierFreq,
        beatFreq,
        leftEar: `${carrierFreq} Hz`,
        rightEar: `${carrierFreq + beatFreq} Hz`,
        brainwavePulse: `${beatFreq} Hz`,
      });

    } catch (error) {
      this.state = PlaybackState.IDLE;
      
      if (error instanceof AudioEngineError) {
        throw error;
      }
      
      throw new AudioEngineError(
        'Error al reproducir pulso binaural',
        ErrorCode.PLAYBACK_ERROR,
        error
      );
    }
  }

  /**
   * Reproduce un preset predefinido de onda cerebral
   * 
   * @param state - Estado de onda cerebral deseado
   * 
   * @example
   * // Entrar en estado Alpha (relajación)
   * engine.playPreset(BrainwaveState.ALPHA);
   * 
   * // Entrar en estado Theta (meditación profunda)
   * engine.playPreset(BrainwaveState.THETA);
   */
  public async playPreset(state: BrainwaveState): Promise<void> {
    const preset = BRAINWAVE_PRESETS[state];
    
    this.log(`Reproduciendo preset: ${preset.description}`, preset);
    
    await this.play(preset.carrierFrequency, preset.beatFrequency);
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. DETENER REPRODUCCIÓN
  // ═══════════════════════════════════════════════════════════════

  /**
   * Detiene la reproducción con fade out suave
   * 
   * @example
   * await engine.stop();
   */
  public async stop(): Promise<void> {
    if (this.state !== PlaybackState.PLAYING) {
      return; // Ya está detenido
    }

    // Cancelar cualquier stop pendiente
    if (this.stopTimeout !== null) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }

    this.state = PlaybackState.STOPPING;

    try {
      if (!this.context || !this.masterGain) return;

      const now = this.context.currentTime;
      const fadeOutDuration = BINAURAL_CONFIG.FADE_OUT.duration;

      // ─────────────────────────────────────────────────────────
      // FADE OUT (para eliminar clicks al final)
      // ─────────────────────────────────────────────────────────

      // Obtener volumen actual
      const currentVolume = this.masterGain.gain.value;
      
      // Bajar gradualmente a silencio
      this.masterGain.gain.setValueAtTime(currentVolume, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + fadeOutDuration);

      // ─────────────────────────────────────────────────────────
      // DETENER Y LIMPIAR
      // ─────────────────────────────────────────────────────────

      // Esperar a que termine el fade out antes de detener
      const stopDelay = (fadeOutDuration * 1000) + BINAURAL_CONFIG.ASYNC_BUFFER_MS;

      await new Promise<void>((resolve) => {
        this.stopTimeout = window.setTimeout(() => {
          try {
            // Detener osciladores
            if (this.leftOscillator) {
              this.leftOscillator.stop();
              this.leftOscillator.disconnect();
              this.leftOscillator = null;
            }

            if (this.rightOscillator) {
              this.rightOscillator.stop();
              this.rightOscillator.disconnect();
              this.rightOscillator = null;
            }

            // Desconectar panners
            if (this.leftPanner) {
              this.leftPanner.disconnect();
              this.leftPanner = null;
            }

            if (this.rightPanner) {
              this.rightPanner.disconnect();
              this.rightPanner = null;
            }

            // Restaurar volumen para próxima reproducción
            if (this.masterGain && this.context) {
              this.masterGain.gain.setValueAtTime(
                BINAURAL_CONFIG.INITIAL_VOLUME,
                this.context.currentTime
              );
            }

            this.state = PlaybackState.IDLE;
            this.stopTimeout = null;

            this.log('Pulso binaural detenido correctamente');
            resolve();
          } catch (error) {
            this.log('Error al detener osciladores', error, 'error');
            resolve(); // Resolver de todos modos
          }
        }, stopDelay);
      });

    } catch (error) {
      this.state = PlaybackState.IDLE;
      this.log('Error durante el proceso de detención', error, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. CONTROL DE VOLUMEN CON ESCALA LOGARÍTMICA
  // ═══════════════════════════════════════════════════════════════

  /**
   * Ajusta el volumen con percepción logarítmica natural
   * 
   * @param percentage - Volumen en porcentaje (0-100)
   * 
   * @example
   * engine.setVolume(50);  // 50% de volumen (suena como "mitad")
   * engine.setVolume(25);  // 25% de volumen
   * engine.setVolume(100); // Volumen máximo
   */
  public setVolume(percentage: number): void {
    if (!this.masterGain) return;

    this.validateVolume(percentage / 100);

    // Validar rango
    const clamped = Math.max(0, Math.min(100, percentage));

    // Convertir a ganancia lineal con curva logarítmica
    const gainValue = percentageToGain(clamped);

    // Aplicar con rampa suave para evitar clicks
    const now = this.context!.currentTime;
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(gainValue, now + 0.05);

    this.log('Volumen ajustado', {
      percentage: `${clamped}%`,
      linearGain: gainValue.toFixed(3),
      decibels: `${gainToDb(gainValue).toFixed(1)} dB`,
    });
  }

  /**
   * Obtiene el volumen actual en diferentes escalas
   * 
   * @returns Objeto con volumen en diferentes unidades
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
  // 8. CAMBIO DE FRECUENCIAS EN TIEMPO REAL
  // ═══════════════════════════════════════════════════════════════

  /**
   * Cambia las frecuencias suavemente sin detener la reproducción
   * Útil para transiciones entre estados mentales
   * 
   * @param carrierFreq - Nueva frecuencia portadora
   * @param beatFreq - Nueva frecuencia de pulso
   * 
   * @example
   * // Empezar en Alpha (10 Hz)
   * await engine.play(440, 10);
   * 
   * // Después de 5 minutos, transicionar a Theta (6 Hz)
   * setTimeout(() => {
   *   engine.updateFrequencies(420, 6);
   * }, 300000);
   */
  public updateFrequencies(carrierFreq: number, beatFreq: number): void {
    if (this.state !== PlaybackState.PLAYING) {
      this.log('No se pueden actualizar frecuencias: no está reproduciendo', null, 'warn');
      return;
    }

    // Validar nuevas frecuencias
    this.validateCarrierFrequency(carrierFreq);
    this.validateBeatFrequency(beatFreq);

    if (!this.context || !this.leftOscillator || !this.rightOscillator) return;

    const now = this.context.currentTime;
    const rampTime = BINAURAL_CONFIG.FREQUENCY_RAMP_TIME;

    // ─────────────────────────────────────────────────────────
    // TRANSICIÓN SUAVE DE FRECUENCIAS
    // ─────────────────────────────────────────────────────────

    // Canal izquierdo (frecuencia base)
    this.leftOscillator.frequency.setValueAtTime(
      this.leftOscillator.frequency.value,
      now
    );
    this.leftOscillator.frequency.linearRampToValueAtTime(carrierFreq, now + rampTime);

    // Canal derecho (frecuencia base + diferencia)
    this.rightOscillator.frequency.setValueAtTime(
      this.rightOscillator.frequency.value,
      now
    );
    this.rightOscillator.frequency.linearRampToValueAtTime(
      carrierFreq + beatFreq,
      now + rampTime
    );

    // Actualizar estado interno
    this.currentCarrierFreq = carrierFreq;
    this.currentBeatFreq = beatFreq;

    this.log('Frecuencias actualizadas en tiempo real', {
      from: {
        carrier: this.currentCarrierFreq,
        beat: this.currentBeatFreq,
      },
      to: {
        carrier: carrierFreq,
        beat: beatFreq,
        leftEar: `${carrierFreq} Hz`,
        rightEar: `${carrierFreq + beatFreq} Hz`,
      },
      transitionTime: `${rampTime}s`,
    });
  }

  /**
   * Transiciona suavemente a un preset predefinido
   * 
   * @param state - Estado de onda cerebral objetivo
   */
  public transitionToPreset(state: BrainwaveState): void {
    const preset = BRAINWAVE_PRESETS[state];
    
    this.log(`Transicionando a: ${preset.description}`, preset);
    
    this.updateFrequencies(preset.carrierFrequency, preset.beatFrequency);
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. GETTERS DE ESTADO
  // ═══════════════════════════════════════════════════════════════

  /**
   * Obtiene el estado actual de reproducción
   */
  public getState(): PlaybackState {
    return this.state;
  }

  /**
   * Verifica si está reproduciendo actualmente
   */
  public isPlaying(): boolean {
    return this.state === PlaybackState.PLAYING;
  }

  /**
   * Obtiene las frecuencias actuales
   */
  public getCurrentFrequencies(): { carrier: number; beat: number } {
    return {
      carrier: this.currentCarrierFreq,
      beat: this.currentBeatFreq,
    };
  }

  /**
   * Obtiene información del AudioContext
   */
  public getAudioContextInfo(): any {
    if (!this.context) return null;

    return {
      sampleRate: this.context.sampleRate,
      currentTime: this.context.currentTime,
      state: this.context.state,
      baseLatency: this.context.baseLatency,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 10. LIMPIEZA Y DESTRUCCIÓN
  // ═══════════════════════════════════════════════════════════════

  /**
   * Limpia todos los recursos y cierra el AudioContext
   * Llamar cuando ya no se necesite el motor
   */
  public async dispose(): Promise<void> {
    await this.stop();

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    this.masterGain = null;
    this.state = PlaybackState.IDLE;

    this.log('Motor de audio destruido y recursos liberados');
  }

  // ═══════════════════════════════════════════════════════════════
  // 11. UTILIDADES INTERNAS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Helper para crear delays asíncronos
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sistema de logging condicional
   */
  private log(message: string, data?: any, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
    if (!DEBUG_CONFIG.ENABLE_LOGGING) return;

    const prefix = '[BinauralEngine]';
    
    switch (level) {
      case 'debug':
        if (DEBUG_CONFIG.LOG_LEVEL === 'debug') {
          console.log(`${prefix} 🔍`, message, data);
        }
        break;
      case 'info':
        console.log(`${prefix} ℹ️`, message, data || '');
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