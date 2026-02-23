/**
 * ═══════════════════════════════════════════════════════════════
 * MOTOR SUBLIMINAL SILENCIOSO (SILENT ENGINE) - VERSIÓN ESTRICTA
 * ═══════════════════════════════════════════════════════════════
 * 
 * Compatibilidad con TypeScript estricto (Vite 8):
 * ✅ Sin enums (usa objetos constantes)
 * ✅ Sin parámetros de propiedad en constructores
 * ✅ Imports de tipo explícitos con 'type'
 * ✅ Higiene espectral: Portadora 17.5 kHz + LFO anti-habituación
 * 
 * CARACTERÍSTICAS:
 * ✅ Portadora Ultrasónica: 17,500 Hz (Inaudible conscientemente)
 * ✅ Modulación LFO: Oscilación lenta para evitar habituación neural
 * ✅ Modulación de Amplitud (AM): Monta mensajes de voz sobre portadora
 * ✅ Carga de archivos externos: MP3, WAV, OGG
 * ✅ Control independiente de volumen portadora/mensaje
 * ✅ Integración con AudioMixer
 * 
 * @version 2.0
 */

import {
  AudioEngineError,
  ErrorCode,
  PlaybackState,
  FREQUENCY_LIMITS,
  type AMModulationConfig,
  type AudioFileInfo,
} from './types';

import {
  SUBLIMINAL_CONFIG,
  AUDIO_CONTEXT_CONFIG,
  DEBUG_CONFIG,
  percentageToGain,
  gainToPercentage,
} from './AudioEngineConfig';

/**
 * Clase principal del motor subliminal silencioso
 */
export class SilentEngine {
  // ═══════════════════════════════════════════════════════════════
  // 1. VARIABLES PRIVADAS (Declaradas arriba, no en constructor)
  // ═══════════════════════════════════════════════════════════════

  private context: AudioContext | null;
  private externalContext: boolean;

  /**
   * NODOS DE LA PORTADORA ULTRASÓNICA
   */
  private carrierOscillator: OscillatorNode | null;
  private carrierGain: GainNode | null;

  /**
   * NODOS DEL LFO (ANTI-HABITUACIÓN)
   */
  private lfoOscillator: OscillatorNode | null;
  private lfoGain: GainNode | null;

  /**
   * NODOS DE MODULACIÓN AM
   */
  private messageSource: AudioBufferSourceNode | null;
  private messageGain: GainNode | null;
  private modulatorGain: GainNode | null;

  /**
   * NODO MAESTRO
   */
  private masterGain: GainNode | null;

  /**
   * BUFFER DEL MENSAJE DE AUDIO
   */
  private audioBuffer: AudioBuffer | null;
  private audioFileInfo: AudioFileInfo | null;

  /**
   * ESTADO
   */
  private state: PlaybackState;
  private currentLFOFreq: number;
  private isModulated: boolean;

  /**
   * CONEXIÓN AL MIXER
   */
  private outputNode: GainNode | null;

  // ═══════════════════════════════════════════════════════════════
  // 2. CONSTRUCTOR (Sin parámetros de propiedad)
  // ═══════════════════════════════════════════════════════════════

  constructor(sharedContext?: AudioContext) {
    // Inicializar todas las propiedades explícitamente
    this.context = null;
    this.externalContext = false;
    this.carrierOscillator = null;
    this.carrierGain = null;
    this.lfoOscillator = null;
    this.lfoGain = null;
    this.messageSource = null;
    this.messageGain = null;
    this.modulatorGain = null;
    this.masterGain = null;
    this.audioBuffer = null;
    this.audioFileInfo = null;
    this.state = PlaybackState.IDLE;
    this.currentLFOFreq = 0.5;
    this.isModulated = false;
    this.outputNode = null;

    // Asignar contexto compartido si se proporciona
    if (sharedContext) {
      this.context = sharedContext;
      this.externalContext = true;
      this.initializeNodes(); 
      console.log('SilentEngine: Nodos inicializados con contexto compartido');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. INICIALIZACIÓN
  // ═══════════════════════════════════════════════════════════════

  /**
   * Inicializa el AudioContext y nodos base
   */
  private async init(): Promise<void> {
    // Si usa contexto externo y ya existe, solo verificar estado
    if (this.externalContext && this.context) {
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      this.initializeNodes();
      return;
    }

    // Si no tiene contexto, crear uno nuevo
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

      // Crear contexto con configuración optimizada
      this.context = new AudioContextClass({
        latencyHint: AUDIO_CONTEXT_CONFIG.LATENCY_HINT,
        sampleRate: AUDIO_CONTEXT_CONFIG.SAMPLE_RATE,
      });

      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      this.initializeNodes();

      this.log('AudioContext de Alta Frecuencia iniciado', {
        sampleRate: this.context.sampleRate,
        state: this.context.state,
        maxFrequency: this.context.sampleRate / 2,
      });

    } catch (error) {
      throw new AudioEngineError(
        'Error al inicializar el motor subliminal',
        ErrorCode.CONTEXT_NOT_INITIALIZED,
        error
      );
    }
  }

  /**
   * Inicializa los nodos de audio base
   */
  private initializeNodes(): void {
    if (!this.context) return;

    // Ganancia maestra
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = SUBLIMINAL_CONFIG.MESSAGE_VOLUME;

    // Nodo de salida (para conectar al mixer o a destination)
    this.outputNode = this.context.createGain();
    this.outputNode.gain.value = 1.0;

    // Conectar: Master -> Output
    this.masterGain.connect(this.outputNode);

    // Si no usa contexto externo, conectar directo a destination
    if (!this.externalContext) {
      this.outputNode.connect(this.context.destination);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. CARGA DE ARCHIVOS DE AUDIO (MENSAJES)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Carga un archivo de audio para modular sobre la portadora
   */
  public async loadAudioFile(file: File | Blob): Promise<AudioFileInfo> {
    if (!this.context) await this.init();
    if (!this.context) {
      throw new AudioEngineError(
        'AudioContext no disponible',
        ErrorCode.CONTEXT_NOT_INITIALIZED
      );
    }

    try {
      this.log('Cargando archivo de audio...', { name: (file as File).name, size: file.size });

      const arrayBuffer = await file.arrayBuffer();
      this.audioBuffer = await this.context.decodeAudioData(arrayBuffer);

      this.audioFileInfo = {
        name: (file as File).name || 'audio',
        duration: this.audioBuffer.duration,
        sampleRate: this.audioBuffer.sampleRate,
        channels: this.audioBuffer.numberOfChannels,
        size: file.size,
        format: this.getFileFormat((file as File).name),
      };

      this.log('Archivo cargado exitosamente', this.audioFileInfo);
      return this.audioFileInfo;

    } catch (error) {
      throw new AudioEngineError(
        'Error al cargar el archivo de audio',
        ErrorCode.FILE_LOAD_ERROR,
        error
      );
    }
  }

  /**
   * Carga un archivo de audio desde una URL
   */
  public async loadAudioFromURL(url: string): Promise<AudioFileInfo> {
    if (!this.context) await this.init();
    if (!this.context) {
      throw new AudioEngineError(
        'AudioContext no disponible',
        ErrorCode.CONTEXT_NOT_INITIALIZED
      );
    }

    try {
      this.log('Cargando audio desde URL...', { url });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.context.decodeAudioData(arrayBuffer);

      const fileName = url.split('/').pop() || 'audio';

      this.audioFileInfo = {
        name: fileName,
        duration: this.audioBuffer.duration,
        sampleRate: this.audioBuffer.sampleRate,
        channels: this.audioBuffer.numberOfChannels,
        size: arrayBuffer.byteLength,
        format: this.getFileFormat(fileName),
      };

      this.log('Audio cargado desde URL', this.audioFileInfo);
      return this.audioFileInfo;

    } catch (error) {
      throw new AudioEngineError(
        'Error al cargar audio desde URL',
        ErrorCode.FILE_LOAD_ERROR,
        error
      );
    }
  }

  /**
   * Obtiene el formato del archivo desde el nombre
   */
  private getFileFormat(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ext || 'unknown';
  }

  /**
   * Obtiene información del AudioBuffer actual
   */
  public getLoadedAudioInfo(): AudioFileInfo | null {
    return this.audioFileInfo;
  }

  /**
   * Limpia el AudioBuffer cargado
   */
  public clearAudioBuffer(): void {
    this.audioBuffer = null;
    this.audioFileInfo = null;
    this.log('AudioBuffer limpiado');
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. REPRODUCCIÓN (MODO SIMPLE - SIN MODULACIÓN)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Reproduce solo la portadora ultrasónica con LFO
   * (Sin modulación AM - modo simple)
   * 
   * HIGIENE ESPECTRAL:
   * - Portadora: 17,500 Hz (límite audición consciente)
   * - LFO: 0.1-3 Hz (evita habituación neural)
   * - Modulación de frecuencia: ±5 Hz
   */
  public async play(lfoFrequency: number = 0.5): Promise<void> {
    try {
      await this.init();

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
      // A. GENERAR PORTADORA ULTRASÓNICA (17.5 kHz)
      // ─────────────────────────────────────────────────────────

      this.carrierOscillator = this.context.createOscillator();
      this.carrierOscillator.type = 'sine';
      this.carrierOscillator.frequency.value = FREQUENCY_LIMITS.SUBLIMINAL_CARRIER;

      this.carrierGain = this.context.createGain();
      this.carrierGain.gain.value = 1.0;

      // ─────────────────────────────────────────────────────────
      // B. GENERAR LFO (ANTI-HABITUACIÓN)
      // ─────────────────────────────────────────────────────────

      this.lfoOscillator = this.context.createOscillator();
      this.lfoOscillator.type = 'sine';
      this.lfoOscillator.frequency.value = lfoFrequency;

      this.lfoGain = this.context.createGain();
      this.lfoGain.gain.value = SUBLIMINAL_CONFIG.LFO_MAX || 5;

      // ─────────────────────────────────────────────────────────
      // C. CONECTAR MODULACIÓN DE FRECUENCIA (LFO → Carrier)
      // ─────────────────────────────────────────────────────────

      this.lfoOscillator.connect(this.lfoGain);
      this.lfoGain.connect(this.carrierOscillator.frequency);

      this.carrierOscillator.connect(this.carrierGain);
      this.carrierGain.connect(this.masterGain);

      // ─────────────────────────────────────────────────────────
      // D. FADE IN
      // ─────────────────────────────────────────────────────────

      const fadeInDuration = SUBLIMINAL_CONFIG.FADE_IN.duration;
      const currentVolume = this.masterGain.gain.value;

      this.masterGain.gain.setValueAtTime(0, now);
      this.masterGain.gain.linearRampToValueAtTime(currentVolume, now + fadeInDuration);

      // ─────────────────────────────────────────────────────────
      // E. INICIAR
      // ─────────────────────────────────────────────────────────

      this.carrierOscillator.start(now);
      this.lfoOscillator.start(now);

      this.state = PlaybackState.PLAYING;
      this.currentLFOFreq = lfoFrequency;
      this.isModulated = false;

      this.log('Transmisión Silenciosa Activa (Sin modulación AM)', {
        carrierFreq: `${FREQUENCY_LIMITS.SUBLIMINAL_CARRIER} Hz`,
        lfoFreq: `${lfoFrequency} Hz`,
        mode: 'Simple',
      });

    } catch (error) {
      this.state = PlaybackState.IDLE;

      if (error instanceof AudioEngineError) {
        throw error;
      }

      throw new AudioEngineError(
        'Error al iniciar motor silencioso',
        ErrorCode.PLAYBACK_ERROR,
        error
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. REPRODUCCIÓN CON MODULACIÓN AM
  // ═══════════════════════════════════════════════════════════════

  /**
   * Reproduce la portadora ultrasónica CON modulación AM
   * (Monta el mensaje de audio sobre la portadora)
   * 
   * HIGIENE ESPECTRAL + MODULACIÓN AM:
   * - Portadora: 17,500 Hz modulada con mensaje
   * - LFO: Variación adicional de frecuencia
   * - Profundidad AM: Configurable 0-1
   */
  public async playWithAM(
    config: Partial<AMModulationConfig> = {},
    loop: boolean = false
  ): Promise<void> {
    if (!this.audioBuffer) {
      throw new AudioEngineError(
        'No hay archivo de audio cargado. Usa loadAudioFile() primero.',
        ErrorCode.MODULATION_ERROR
      );
    }

    try {
      await this.init();

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

      const amConfig: AMModulationConfig = {
        modulationDepth: config.modulationDepth ?? 1.0,
        carrierFrequency: config.carrierFrequency ?? FREQUENCY_LIMITS.SUBLIMINAL_CARRIER,
        messageGain: config.messageGain ?? 0.5,
      };

      // ─────────────────────────────────────────────────────────
      // A. GENERAR PORTADORA ULTRASÓNICA
      // ─────────────────────────────────────────────────────────

      this.carrierOscillator = this.context.createOscillator();
      this.carrierOscillator.type = 'sine';
      this.carrierOscillator.frequency.value = amConfig.carrierFrequency;

      this.carrierGain = this.context.createGain();
      this.carrierGain.gain.value = 1.0;

      // ─────────────────────────────────────────────────────────
      // B. CARGAR EL MENSAJE DE AUDIO
      // ─────────────────────────────────────────────────────────

      this.messageSource = this.context.createBufferSource();
      this.messageSource.buffer = this.audioBuffer;
      this.messageSource.loop = loop;

      this.messageGain = this.context.createGain();
      this.messageGain.gain.value = amConfig.messageGain;

      // ─────────────────────────────────────────────────────────
      // C. CREAR MODULADOR (AM)
      // ─────────────────────────────────────────────────────────

      this.modulatorGain = this.context.createGain();
      this.modulatorGain.gain.value = 0.5;

      // ─────────────────────────────────────────────────────────
      // D. CONECTAR CADENA DE MODULACIÓN AM
      // ─────────────────────────────────────────────────────────

      this.messageSource.connect(this.messageGain);
      
      const scaledGain = this.context.createGain();
      scaledGain.gain.value = 0.5 * amConfig.modulationDepth;
      
      this.messageGain.connect(scaledGain);
      scaledGain.connect(this.modulatorGain.gain);

      this.carrierOscillator.connect(this.carrierGain);
      this.carrierGain.connect(this.modulatorGain);
      this.modulatorGain.connect(this.masterGain);

      // ─────────────────────────────────────────────────────────
      // E. GENERAR LFO (OPCIONAL - variación adicional)
      // ─────────────────────────────────────────────────────────

      const lfoFreq = 0.3;
      this.lfoOscillator = this.context.createOscillator();
      this.lfoOscillator.type = 'sine';
      this.lfoOscillator.frequency.value = lfoFreq;

      this.lfoGain = this.context.createGain();
      this.lfoGain.gain.value = 3;

      this.lfoOscillator.connect(this.lfoGain);
      this.lfoGain.connect(this.carrierOscillator.frequency);

      // ─────────────────────────────────────────────────────────
      // F. FADE IN
      // ─────────────────────────────────────────────────────────

      const fadeInDuration = SUBLIMINAL_CONFIG.FADE_IN.duration;
      const currentVolume = this.masterGain.gain.value;

      this.masterGain.gain.setValueAtTime(0, now);
      this.masterGain.gain.linearRampToValueAtTime(currentVolume, now + fadeInDuration);

      // ─────────────────────────────────────────────────────────
      // G. INICIAR TODO
      // ─────────────────────────────────────────────────────────

      this.carrierOscillator.start(now);
      this.lfoOscillator.start(now);
      this.messageSource.start(now);

      if (!loop) {
        this.messageSource.onended = () => {
          this.log('Mensaje completado, deteniendo...');
          this.stop();
        };
      }

      this.state = PlaybackState.PLAYING;
      this.currentLFOFreq = lfoFreq;
      this.isModulated = true;

      this.log('Transmisión Silenciosa con AM Activa', {
        carrierFreq: `${amConfig.carrierFrequency} Hz`,
        messageFile: this.audioFileInfo?.name,
        messageDuration: `${this.audioBuffer.duration.toFixed(1)}s`,
        modulationDepth: `${(amConfig.modulationDepth * 100).toFixed(0)}%`,
        messageGain: amConfig.messageGain,
        loop: loop ? 'Sí' : 'No',
      });

    } catch (error) {
      this.state = PlaybackState.IDLE;

      if (error instanceof AudioEngineError) {
        throw error;
      }

      throw new AudioEngineError(
        'Error al iniciar modulación AM',
        ErrorCode.MODULATION_ERROR,
        error
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. DETENER REPRODUCCIÓN
  // ═══════════════════════════════════════════════════════════════

  public async stop(): Promise<void> {
    if (this.state !== PlaybackState.PLAYING) return;

    this.state = PlaybackState.STOPPING;

    try {
      if (!this.context || !this.masterGain) return;

      const now = this.context.currentTime;
      const fadeOutDuration = SUBLIMINAL_CONFIG.FADE_OUT.duration;

      const currentVolume = this.masterGain.gain.value;
      this.masterGain.gain.setValueAtTime(currentVolume, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + fadeOutDuration);

      await this.delay((fadeOutDuration * 1000) + 50);

      this.stopAndDisconnectNodes();

      if (this.masterGain && this.context) {
        this.masterGain.gain.setValueAtTime(
          SUBLIMINAL_CONFIG.MESSAGE_VOLUME,
          this.context.currentTime
        );
      }

      this.state = PlaybackState.IDLE;
      this.log('Transmisión detenida');

    } catch (error) {
      this.state = PlaybackState.IDLE;
      this.log('Error al detener', error, 'error');
    }
  }

  private stopAndDisconnectNodes(): void {
    if (this.carrierOscillator) {
      try { this.carrierOscillator.stop(); this.carrierOscillator.disconnect(); } catch (e) {}
      this.carrierOscillator = null;
    }

    if (this.carrierGain) {
      this.carrierGain.disconnect();
      this.carrierGain = null;
    }

    if (this.lfoOscillator) {
      try { this.lfoOscillator.stop(); this.lfoOscillator.disconnect(); } catch (e) {}
      this.lfoOscillator = null;
    }

    if (this.lfoGain) {
      this.lfoGain.disconnect();
      this.lfoGain = null;
    }

    if (this.messageSource) {
      try { this.messageSource.stop(); this.messageSource.disconnect(); } catch (e) {}
      this.messageSource = null;
    }

    if (this.messageGain) {
      this.messageGain.disconnect();
      this.messageGain = null;
    }

    if (this.modulatorGain) {
      this.modulatorGain.disconnect();
      this.modulatorGain = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. CONTROL DE VOLUMEN
  // ═══════════════════════════════════════════════════════════════

  public setVolume(percentage: number): void {
    if (!this.masterGain || !this.context) return;

    const clamped = Math.max(0, Math.min(100, percentage));
    const gainValue = percentageToGain(clamped);

    const now = this.context.currentTime;
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(gainValue, now + 0.05);

    this.log('Volumen ajustado', { percentage: `${clamped}%` });
  }

  public getVolume(): number {
    if (!this.masterGain) return 0;
    return gainToPercentage(this.masterGain.gain.value);
  }

  public setLFOFrequency(frequency: number): void {
    if (!this.lfoOscillator || !this.context) return;
    if (this.state !== PlaybackState.PLAYING) return;

    const now = this.context.currentTime;
    this.lfoOscillator.frequency.setValueAtTime(
      this.lfoOscillator.frequency.value,
      now
    );
    this.lfoOscillator.frequency.linearRampToValueAtTime(frequency, now + 0.1);

    this.currentLFOFreq = frequency;
    this.log('Frecuencia LFO actualizada', { frequency: `${frequency} Hz` });
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. GETTERS Y ESTADO
  // ═══════════════════════════════════════════════════════════════

  public getState(): PlaybackState {
    return this.state;
  }

  public isPlaying(): boolean {
    return this.state === PlaybackState.PLAYING;
  }

  public hasModulation(): boolean {
    return this.isModulated;
  }

  public getCurrentLFOFrequency(): number {
    return this.currentLFOFreq;
  }

  public getOutputNode(): GainNode | null {
    return this.outputNode;
  }

  public connectTo(destination: AudioNode): void {
    if (this.outputNode) {
      this.outputNode.connect(destination);
    }
  }

  public disconnect(): void {
    if (this.outputNode) {
      this.outputNode.disconnect();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 10. LIMPIEZA Y DESTRUCCIÓN
  // ═══════════════════════════════════════════════════════════════

  public async dispose(): Promise<void> {
    await this.stop();

    this.clearAudioBuffer();

    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }

    if (this.outputNode) {
      this.outputNode.disconnect();
      this.outputNode = null;
    }

    if (this.context && !this.externalContext) {
      await this.context.close();
      this.context = null;
    }

    this.state = PlaybackState.IDLE;
    this.log('Motor silencioso destruido y recursos liberados');
  }

  // ═══════════════════════════════════════════════════════════════
  // 11. UTILIDADES
  // ═══════════════════════════════════════════════════════════════

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(message: string, data?: any, level: 'info' | 'error' = 'info'): void {
    if (!DEBUG_CONFIG.ENABLE_LOGGING) return;

    const prefix = '[SilentEngine]';
    const icon = level === 'error' ? '❌' : '🤫';

    if (level === 'error') {
      console.error(`${prefix} ${icon}`, message, data || '');
    } else {
      console.log(`${prefix} ${icon}`, message, data || '');
    }
  }
}