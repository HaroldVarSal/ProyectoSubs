/**
 * ═══════════════════════════════════════════════════════════════
 * AUDIO MIXER (EL CRISOL) - VERSIÓN OPTIMIZADA
 * ═══════════════════════════════════════════════════════════════
 * 
 * Compatibilidad TypeScript estricto (Vite 8):
 * ✅ Sin enums
 * ✅ Import type explícitos
 * ✅ Sin parámetros de propiedad
 * 
 * RESPONSABILIDADES:
 * 1. Gestión centralizada del AudioContext
 * 2. Cadena de procesamiento profesional
 * 3. Compresión/Limitación para seguridad auditiva
 * 4. Análisis FFT para visualizaciones
 * 5. Preparación para grabación
 * 6. Control maestro de volumen
 * 
 * MEJORAS IMPLEMENTADAS:
 * ✓ Gestión robusta de autoplay policies
 * ✓ Cadena de procesamiento optimizada (Pre-Analyzer + Compressor + Limiter)
 * ✓ Análisis FFT configurable y mejorado
 * ✓ Fades suaves al conectar/desconectar motores
 * ✓ Tracking de motores conectados
 * ✓ Performance monitoring
 * ✓ Control individual por motor (volumen, mute, solo)
 * 
 * @version 2.0
 */

import {
  AudioEngineError,
  ErrorCode,
  type AudioPerformanceMetrics,
  type ConnectedEngineInfo,
  type AnalyzerConfig,
  AudioContextState,
} from './types';

import {
  AUDIO_CONTEXT_CONFIG,
  MIXER_CONFIG,
  DEBUG_CONFIG,
} from './AudioEngineConfig';

/**
 * Interfaz genérica para cualquier motor conectable
 */
interface ConnectableEngine {
  connectTo(destination: AudioNode): void;
  disconnect(): void;
  getOutputNode(): GainNode | null;
}

/**
 * Clase principal del mezclador
 */
export class AudioMixer {
  // ═══════════════════════════════════════════════════════════════
  // 1. VARIABLES PRIVADAS
  // ═══════════════════════════════════════════════════════════════

  private context: AudioContext | null;
  private externalContext: boolean;

  /**
   * CADENA DE PROCESAMIENTO
   */
  private inputNode: GainNode | null;
  private preAnalyzer: AnalyserNode | null;       // MEJORA: Análisis pre-procesamiento
  private compressor: DynamicsCompressorNode | null;
  private limiter: DynamicsCompressorNode | null; // MEJORA: Limitador separado
  private postAnalyzer: AnalyserNode | null;      // Análisis post-procesamiento
  private masterGain: GainNode | null;

  /**
   * GRABACIÓN
   */
  private streamDestination: MediaStreamAudioDestinationNode | null;

  /**
   * MOTORES CONECTADOS (MEJORA)
   */
  private connectedEngines: Map<string, ConnectedEngineInfo>;

  /**
   * ESTADO
   */
  private isInitialized: boolean;
  private masterVolume: number;
  private autoResumeEnabled: boolean;

  /**
   * PERFORMANCE MONITORING (MEJORA)
   */
  private performanceMetrics: AudioPerformanceMetrics;
  private monitoringInterval: number | null;

  // ═══════════════════════════════════════════════════════════════
  // 2. CONSTRUCTOR (Sin parámetros de propiedad)
  // ═══════════════════════════════════════════════════════════════

  constructor(sharedContext?: AudioContext) {
    // Inicializar todas las propiedades explícitamente
    this.context = null;
    this.externalContext = false;
    this.inputNode = null;
    this.preAnalyzer = null;
    this.compressor = null;
    this.limiter = null;
    this.postAnalyzer = null;
    this.masterGain = null;
    this.streamDestination = null;
    this.connectedEngines = new Map();
    this.isInitialized = false;
    this.masterVolume = MIXER_CONFIG.MASTER_VOLUME || 0.8;
    this.autoResumeEnabled = true;
    this.performanceMetrics = {
      cpuUsage: 0,
      latency: 0,
      bufferSize: 0,
      activeNodes: 0,
      droppedFrames: 0,
    };
    this.monitoringInterval = null;

    // Asignar contexto compartido si existe
    if (sharedContext) {
      this.context = sharedContext;
      this.externalContext = true;
      this.log('Inicializado con AudioContext compartido');
    } else {
      this.log('Inicializado (creará contexto propio)');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. INICIALIZACIÓN
  // ═══════════════════════════════════════════════════════════════

  /**
   * MEJORA: Inicialización robusta con manejo de autoplay policies
   */
  public async init(): Promise<void> {
    if (this.isInitialized && this.context) {
      // Verificar estado del contexto
      if (this.context.state === AudioContextState.SUSPENDED) {
        this.log('Contexto suspendido, intentando reanudar...', null, 'warn');
        await this.resumeContext();
      }
      return;
    }

    try {
      // Obtener o crear contexto
      if (!this.context) {
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

        this.log('AudioContext creado', {
          sampleRate: this.context.sampleRate,
          state: this.context.state,
          baseLatency: this.context.baseLatency,
        });
      }

      // MEJORA: Manejo proactivo de autoplay policies
      if (this.context.state === AudioContextState.SUSPENDED) {
        this.log(
          '⚠️ AudioContext suspendido (autoplay policy). Llama a resumeContext() tras interacción del usuario.',
          null,
          'warn'
        );

        // Agregar listener para auto-resume en interacción
        if (this.autoResumeEnabled) {
          this.setupAutoResume();
        }
      }

      // Construir cadena de procesamiento
      this.buildProcessingChain();

      // Iniciar monitoring si está habilitado
      if (MIXER_CONFIG.ENABLE_ANALYZER) {
        this.startPerformanceMonitoring();
      }

      this.isInitialized = true;
      this.log('AudioMixer inicializado correctamente');

    } catch (error) {
      throw new AudioEngineError(
        'Error al inicializar el Mezclador',
        ErrorCode.CONTEXT_NOT_INITIALIZED,
        error
      );
    }
  }

  /**
   * MEJORA: Setup auto-resume tras interacción del usuario
   */
  private setupAutoResume(): void {
    const resumeOnInteraction = async () => {
      if (this.context && this.context.state === AudioContextState.SUSPENDED) {
        await this.resumeContext();

        // Remover listeners después del primer resume
        document.removeEventListener('click', resumeOnInteraction);
        document.removeEventListener('touchstart', resumeOnInteraction);
        document.removeEventListener('keydown', resumeOnInteraction);

        this.log('AudioContext reanudado automáticamente tras interacción del usuario');
      }
    };

    // Agregar múltiples listeners para diferentes tipos de interacción
    document.addEventListener('click', resumeOnInteraction, { once: true });
    document.addEventListener('touchstart', resumeOnInteraction, { once: true });
    document.addEventListener('keydown', resumeOnInteraction, { once: true });
  }

  /**
   * MEJORA: Método público para reanudar contexto
   */
  public async resumeContext(): Promise<void> {
    if (!this.context) {
      throw new AudioEngineError(
        'AudioContext no inicializado',
        ErrorCode.CONTEXT_NOT_INITIALIZED
      );
    }

    if (this.context.state === AudioContextState.SUSPENDED) {
      try {
        await this.context.resume();
        this.log('AudioContext reanudado exitosamente');
      } catch (error) {
        this.log('Error al reanudar AudioContext', error, 'error');
        throw new AudioEngineError(
          'No se pudo reanudar el AudioContext',
          ErrorCode.PLAYBACK_ERROR,
          error
        );
      }
    }
  }

  /**
   * MEJORA: Cadena de procesamiento optimizada
   * 
   * Flujo:
   * Input -> Pre-Analyzer -> Compressor -> Limiter -> Post-Analyzer -> Master -> Outputs
   */
  private buildProcessingChain(): void {
    if (!this.context) return;

    // ─────────────────────────────────────────────────────────
    // A. NODO DE ENTRADA (Input Bus)
    // ─────────────────────────────────────────────────────────

    this.inputNode = this.context.createGain();
    this.inputNode.gain.value = 1.0;

    // ─────────────────────────────────────────────────────────
    // B. PRE-ANALYZER (MEJORA: Análisis antes del procesamiento)
    // ─────────────────────────────────────────────────────────

    this.preAnalyzer = this.context.createAnalyser();
    this.configureAnalyzer(this.preAnalyzer, {
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      minDecibels: -90,
      maxDecibels: -10,
    });

    // ─────────────────────────────────────────────────────────
    // C. COMPRESOR DINÁMICO (Suaviza picos manteniendo naturalidad)
    // ─────────────────────────────────────────────────────────

    this.compressor = this.context.createDynamicsCompressor();

    // MEJORA: Configuración más suave y musical
    this.compressor.threshold.value = -24;  // dB
    this.compressor.knee.value = 30;        // Transición suave
    this.compressor.ratio.value = 4;        // Ratio moderado (4:1)
    this.compressor.attack.value = 0.003;   // Rápido (3ms)
    this.compressor.release.value = 0.25;   // Natural (250ms)

    // ─────────────────────────────────────────────────────────
    // D. LIMITADOR (MEJORA: Protección final contra clipping)
    // ─────────────────────────────────────────────────────────

    this.limiter = this.context.createDynamicsCompressor();

    // Configuración de limitador "brickwall"
    this.limiter.threshold.value = -3;      // Techo a -3dB
    this.limiter.knee.value = 0;            // Sin transición (duro)
    this.limiter.ratio.value = 20;          // Ratio extremo (20:1)
    this.limiter.attack.value = 0.001;      // Instantáneo (1ms)
    this.limiter.release.value = 0.1;       // Rápido (100ms)

    // ─────────────────────────────────────────────────────────
    // E. POST-ANALYZER (Análisis después del procesamiento)
    // ─────────────────────────────────────────────────────────

    this.postAnalyzer = this.context.createAnalyser();
    this.configureAnalyzer(this.postAnalyzer, {
      fftSize: MIXER_CONFIG.FFT_SIZE || 2048,
      smoothingTimeConstant: 0.85,
      minDecibels: -90,
      maxDecibels: -10,
    });

    // ─────────────────────────────────────────────────────────
    // F. MASTER GAIN (Volumen final)
    // ─────────────────────────────────────────────────────────

    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.masterVolume;

    // ─────────────────────────────────────────────────────────
    // G. DESTINO DE GRABACIÓN (Stream para MediaRecorder)
    // ─────────────────────────────────────────────────────────

    this.streamDestination = this.context.createMediaStreamDestination();

    // ─────────────────────────────────────────────────────────
    // CONEXIÓN DE LA CADENA
    // ─────────────────────────────────────────────────────────

    // Input -> Pre-Analyzer -> Compressor
    this.inputNode.connect(this.preAnalyzer);
    this.preAnalyzer.connect(this.compressor);

    // Compressor -> Limiter -> Post-Analyzer
    this.compressor.connect(this.limiter);
    this.limiter.connect(this.postAnalyzer);

    // Post-Analyzer -> Master Gain
    this.postAnalyzer.connect(this.masterGain);

    // Master Gain -> Outputs (Speakers + Stream)
    this.masterGain.connect(this.context.destination);
    this.masterGain.connect(this.streamDestination);

    this.log('Cadena de procesamiento construida', {
      nodes: 'Input -> Pre-Analyzer -> Compressor -> Limiter -> Post-Analyzer -> Master -> Outputs',
    });
  }

  /**
   * MEJORA: Configuración de analizador
   */
  private configureAnalyzer(analyzer: AnalyserNode, config: AnalyzerConfig): void {
    analyzer.fftSize = config.fftSize;
    analyzer.smoothingTimeConstant = config.smoothingTimeConstant;
    analyzer.minDecibels = config.minDecibels;
    analyzer.maxDecibels = config.maxDecibels;
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. CONEXIÓN DE MOTORES (MEJORA: Con tracking y fades)
  // ═══════════════════════════════════════════════════════════════

  /**
   * MEJORA: Conecta un motor con fade in suave y tracking
   */
  public connectEngine(
    engine: ConnectableEngine,
    options: {
      id?: string;
      type?: string;
      name?: string;
      volume?: number;
      fadeInDuration?: number;
    } = {}
  ): void {
    if (!this.inputNode || !this.context) {
      this.log('Mixer no inicializado. Llama a init() primero.', null, 'warn');
      return;
    }

    // Generar ID único si no se proporciona
    const engineId = options.id || crypto.randomUUID();

    // Verificar si ya está conectado
    if (this.connectedEngines.has(engineId)) {
      this.log(`Motor ${engineId} ya está conectado`, null, 'warn');
      return;
    }

    try {
      // Crear nodo de ganancia individual para este motor
      const gainNode = this.context.createGain();
      gainNode.gain.value = 0.0001; // Empezar en silencio

      // Conectar: Motor -> Gain Node -> Input Node
      const outputNode = engine.getOutputNode();
      if (!outputNode) {
        throw new Error('Motor no tiene outputNode válido');
      }

      outputNode.connect(gainNode);
      gainNode.connect(this.inputNode);

      // MEJORA: Aplicar fade in suave
      const volume = options.volume ?? 1.0;
      const fadeInDuration = options.fadeInDuration ?? 0.05;
      const now = this.context.currentTime;

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(volume, now + fadeInDuration);

      // Guardar información del motor
      const engineInfo: ConnectedEngineInfo = {
        id: engineId,
        type: options.type || 'unknown',
        name: options.name || `Motor ${engineId.slice(0, 8)}`,
        gainNode,
        volume,
        muted: false,
        solo: false,
      };

      this.connectedEngines.set(engineId, engineInfo);

      this.log(`Motor conectado: ${engineInfo.name}`, {
        id: engineId,
        type: engineInfo.type,
        volume,
        totalEngines: this.connectedEngines.size,
      });

      // Actualizar métricas
      this.updatePerformanceMetrics();

    } catch (error) {
      this.log(`Error al conectar motor ${engineId}`, error, 'error');
      throw new AudioEngineError(
        'Error al conectar motor al mixer',
        ErrorCode.PLAYBACK_ERROR,
        error
      );
    }
  }

  /**
   * MEJORA: Desconecta un motor con fade out suave
   */
  public async disconnectEngine(
    engineId: string,
    fadeOutDuration: number = 0.1
  ): Promise<void> {
    const engineInfo = this.connectedEngines.get(engineId);
    if (!engineInfo || !this.context) {
      this.log(`Motor ${engineId} no encontrado`, null, 'warn');
      return;
    }

    try {
      // Aplicar fade out
      const now = this.context.currentTime;
      engineInfo.gainNode.gain.cancelScheduledValues(now);
      engineInfo.gainNode.gain.setValueAtTime(engineInfo.gainNode.gain.value, now);
      engineInfo.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + fadeOutDuration);

      // Esperar fade out
      await this.delay((fadeOutDuration * 1000) + 50);

      // Desconectar
      engineInfo.gainNode.disconnect();

      // Eliminar de la lista
      this.connectedEngines.delete(engineId);

      this.log(`Motor desconectado: ${engineInfo.name}`, {
        id: engineId,
        remainingEngines: this.connectedEngines.size,
      });

      // Actualizar métricas
      this.updatePerformanceMetrics();

    } catch (error) {
      this.log(`Error al desconectar motor ${engineId}`, error, 'error');
    }
  }

  /**
   * MEJORA: Desconecta todos los motores
   */
  public async disconnectAllEngines(fadeOutDuration: number = 0.1): Promise<void> {
    const engineIds = Array.from(this.connectedEngines.keys());

    for (const id of engineIds) {
      await this.disconnectEngine(id, fadeOutDuration);
    }

    this.log('Todos los motores desconectados');
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. CONTROL DE VOLUMEN (MEJORA: Individual y maestro)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Ajusta el volumen maestro
   */
  public setMasterVolume(value: number): void {
    if (!this.masterGain || !this.context) return;

    const clamped = Math.max(0, Math.min(1.5, value)); // Hasta 150%
    this.masterVolume = clamped;

    const now = this.context.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, clamped),
      now + 0.1
    );

    this.log('Volumen maestro ajustado', { volume: `${(clamped * 100).toFixed(0)}%` });
  }

  /**
   * Obtiene el volumen maestro actual
   */
  public getMasterVolume(): number {
    return this.masterVolume;
  }

  /**
   * MEJORA: Ajusta el volumen de un motor específico
   */
  public setEngineVolume(engineId: string, value: number): void {
    const engineInfo = this.connectedEngines.get(engineId);
    if (!engineInfo || !this.context) {
      this.log(`Motor ${engineId} no encontrado`, null, 'warn');
      return;
    }

    const clamped = Math.max(0, Math.min(2.0, value)); // Hasta 200%
    engineInfo.volume = clamped;

    const now = this.context.currentTime;
    engineInfo.gainNode.gain.cancelScheduledValues(now);
    engineInfo.gainNode.gain.setValueAtTime(engineInfo.gainNode.gain.value, now);
    engineInfo.gainNode.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, clamped),
      now + 0.1
    );

    this.log(`Volumen del motor ${engineInfo.name} ajustado`, {
      volume: `${(clamped * 100).toFixed(0)}%`,
    });
  }

  /**
   * MEJORA: Mutea/desmutea un motor
   */
  public muteEngine(engineId: string, mute: boolean): void {
    const engineInfo = this.connectedEngines.get(engineId);
    if (!engineInfo || !this.context) return;

    engineInfo.muted = mute;

    const now = this.context.currentTime;
    const targetVolume = mute ? 0.0001 : engineInfo.volume;

    engineInfo.gainNode.gain.cancelScheduledValues(now);
    engineInfo.gainNode.gain.setValueAtTime(engineInfo.gainNode.gain.value, now);
    engineInfo.gainNode.gain.exponentialRampToValueAtTime(targetVolume, now + 0.05);

    this.log(`Motor ${engineInfo.name} ${mute ? 'muteado' : 'desmuteado'}`);
  }

  /**
   * MEJORA: Solo para un motor (mutea todos los demás)
   */
  public soloEngine(engineId: string, solo: boolean): void {
    const engineInfo = this.connectedEngines.get(engineId);
    if (!engineInfo) return;

    engineInfo.solo = solo;

    if (solo) {
      // Mutear todos excepto este
      this.connectedEngines.forEach((_info, id) => {
        if (id !== engineId) {
          this.muteEngine(id, true);
        } else {
          this.muteEngine(id, false);
        }
      });
    } else {
      // Desmutear todos
      this.connectedEngines.forEach((_info, id) => {
        this.muteEngine(id, false);
      });
    }

    this.log(`Solo ${solo ? 'activado' : 'desactivado'} en motor ${engineInfo.name}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. ANÁLISIS FFT (MEJORA: Múltiples métodos de análisis)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Obtiene datos de onda en tiempo real (pre-procesamiento)
   */
  public getPreTimeDomainData(array: Uint8Array): void {
    if (this.preAnalyzer) {
      this.preAnalyzer.getByteTimeDomainData(array as Uint8Array<ArrayBuffer>);
    }
  }

  /**
   * Obtiene datos de onda en tiempo real (post-procesamiento)
   */
  public getPostTimeDomainData(array: Uint8Array): void {
    if (this.postAnalyzer) {
      this.postAnalyzer.getByteTimeDomainData(array as Uint8Array<ArrayBuffer>);
    }
  }

  /**
   * MEJORA: Alias para compatibilidad con código existente
   */
  public getTimeDomainData(array: Uint8Array): void {
    this.getPostTimeDomainData(array);
  }

  /**
   * Obtiene datos de frecuencias (pre-procesamiento)
   */
  public getPreFrequencyData(array: Uint8Array): void {
    if (this.preAnalyzer) {
      this.preAnalyzer.getByteFrequencyData(array as Uint8Array<ArrayBuffer>);
    }
  }

  /**
   * Obtiene datos de frecuencias (post-procesamiento)
   */
  public getPostFrequencyData(array: Uint8Array): void {
    if (this.postAnalyzer) {
      this.postAnalyzer.getByteFrequencyData(array as Uint8Array<ArrayBuffer>);
    }
  }

  /**
   * MEJORA: Alias para compatibilidad
   */
  public getFrequencyData(array: Uint8Array): void {
    this.getPostFrequencyData(array);
  }

  /**
   * MEJORA: Obtiene el espectro de frecuencias normalizado
   */
  public getNormalizedFrequencySpectrum(): Float32Array {
    if (!this.postAnalyzer) {
      return new Float32Array(0);
    }

    const bufferLength = this.postAnalyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.postAnalyzer.getByteFrequencyData(dataArray);

    // Normalizar a rango 0-1
    const normalized = new Float32Array(bufferLength);
    for (let i = 0; i < bufferLength; i++) {
      normalized[i] = dataArray[i] / 255;
    }

    return normalized;
  }

  /**
   * MEJORA: Detecta si hay clipping
   */
  public isClipping(): boolean {
    if (!this.postAnalyzer) return false;

    const dataArray = new Uint8Array(this.postAnalyzer.fftSize);
    this.postAnalyzer.getByteTimeDomainData(dataArray);

    // Buscar valores en los extremos (cerca de 0 o 255)
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      if (Math.abs(normalized) >= 0.99) {
        return true;
      }
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. GRABACIÓN
  // ═══════════════════════════════════════════════════════════════

  /**
   * Obtiene el stream de audio para grabación
   */
  public getAudioStream(): MediaStream | null {
    return this.streamDestination ? this.streamDestination.stream : null;
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. PERFORMANCE MONITORING (MEJORA)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Inicia el monitoring de performance
   */
  private startPerformanceMonitoring(): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = window.setInterval(() => {
      this.updatePerformanceMetrics();
    }, 1000);
  }

  /**
   * Actualiza las métricas de performance
   */
  private updatePerformanceMetrics(): void {
    if (!this.context) return;

    // Latencia
    this.performanceMetrics.latency =
      (this.context.baseLatency || 0) * 1000 +
      ((this.context as any).outputLatency || 0) * 1000;

    // Nodos activos
    this.performanceMetrics.activeNodes = this.connectedEngines.size * 3; // Estimado

    // Buffer size (de la configuración)
    this.performanceMetrics.bufferSize = MIXER_CONFIG.BUFFER_SIZE || 2048;

    // CPU usage (estimado basado en motores activos)
    const activeEngines = Array.from(this.connectedEngines.values()).filter(
      (e) => !e.muted
    ).length;
    this.performanceMetrics.cpuUsage = (activeEngines / 4) * 30; // Estimado

    // Detección de clipping
    if (this.isClipping()) {
      this.log('⚠️ Clipping detectado', null, 'warn');
      this.performanceMetrics.droppedFrames++;
    }
  }

  /**
   * Obtiene las métricas actuales
   */
  public getPerformanceMetrics(): AudioPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Detiene el monitoring
   */
  private stopPerformanceMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. GETTERS Y ESTADO
  // ═══════════════════════════════════════════════════════════════

  /**
   * Obtiene el AudioContext compartido
   */
  public getContext(): AudioContext | null {
    return this.context;
  }

  /**
   * Obtiene el estado del contexto
   */
  public getContextState(): AudioContextState {
    if (!this.context) return AudioContextState.CLOSED;
    return this.context.state as AudioContextState;
  }

  /**
   * Verifica si está inicializado
   */
  public isReady(): boolean {
    return this.isInitialized && this.context !== null;
  }

  /**
   * MEJORA: Lista motores conectados
   */
  public getConnectedEngines(): ConnectedEngineInfo[] {
    return Array.from(this.connectedEngines.values());
  }

  /**
   * MEJORA: Obtiene información de un motor específico
   */
  public getEngineInfo(engineId: string): ConnectedEngineInfo | undefined {
    return this.connectedEngines.get(engineId);
  }

  /**
   * Obtiene el nodo de entrada (para conexión manual)
   */
  public getInputNode(): GainNode | null {
    return this.inputNode;
  }

  // ═══════════════════════════════════════════════════════════════
  // 10. LIMPIEZA
  // ═══════════════════════════════════════════════════════════════

  /**
   * Libera todos los recursos
   */
  public async dispose(): Promise<void> {
    // Detener monitoring
    this.stopPerformanceMonitoring();

    // Desconectar todos los motores
    await this.disconnectAllEngines(0.05);

    // Desconectar cadena de procesamiento
    if (this.inputNode) {
      this.inputNode.disconnect();
      this.inputNode = null;
    }

    if (this.preAnalyzer) {
      this.preAnalyzer.disconnect();
      this.preAnalyzer = null;
    }

    if (this.compressor) {
      this.compressor.disconnect();
      this.compressor = null;
    }

    if (this.limiter) {
      this.limiter.disconnect();
      this.limiter = null;
    }

    if (this.postAnalyzer) {
      this.postAnalyzer.disconnect();
      this.postAnalyzer = null;
    }

    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }

    if (this.streamDestination) {
      this.streamDestination.disconnect();
      this.streamDestination = null;
    }

    // Cerrar contexto solo si no es externo
    if (this.context && !this.externalContext) {
      await this.context.close();
      this.context = null;
    }

    this.isInitialized = false;
    this.log('AudioMixer destruido y recursos liberados');
  }

  // ═══════════════════════════════════════════════════════════════
  // 11. UTILIDADES
  // ═══════════════════════════════════════════════════════════════

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(
    message: string,
    data?: any,
    level: 'info' | 'warn' | 'error' = 'info'
  ): void {
    if (!DEBUG_CONFIG.ENABLE_LOGGING) return;

    const prefix = '[AudioMixer]';
    const icons = { info: '🎛️', warn: '⚠️', error: '❌' };
    const icon = icons[level];

    const logFn =
      level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    logFn(`${prefix} ${icon}`, message, data || '');
  }
}