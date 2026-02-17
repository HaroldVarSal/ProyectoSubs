/**
 * ═══════════════════════════════════════════════════════════════
 * MOTOR SUPRALIMINAL DINÁMICO - VERSIÓN OPTIMIZADA
 * ═══════════════════════════════════════════════════════════════
 * 
 * Compatibilidad TypeScript estricto (Vite 8):
 * ✅ Sin enums
 * ✅ Import type explícitos
 * ✅ Sin parámetros de propiedad
 * ✅ Solo Web Audio API pura
 * 
 * MEJORAS IMPLEMENTADAS:
 * ✓ Filtros individuales por capa (BiquadFilterNode)
 * ✓ Fades exponenciales suaves (sin clicks)
 * ✓ Pool de nodos reutilizables
 * ✓ Optimización para 10+ capas simultáneas
 * ✓ Gestión eficiente de memoria
 * 
 * TÉCNICA DE SATURACIÓN COGNITIVA:
 * - Múltiples voces simultáneas con velocidades diferentes
 * - Posicionamiento espacial estereofónico
 * - Filtrado por frecuencias para enmascaramiento
 * - Offsets temporales para efecto "coro"
 * 
 * @version 2.0
 */

import {
  AudioEngineError,
  ErrorCode,
  type SupraliminalLayerConfig,
  type SupraliminalFilterConfig,
  type SupraliminalFadeConfig,
  type SupraliminalEngineState,
} from './types';

import {
  AUDIO_CONTEXT_CONFIG,
  DEBUG_CONFIG,
} from './AudioEngineConfig';

/**
 * Nodos activos de una capa individual
 */
interface LayerNodes {
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner: StereoPannerNode;
  filter: BiquadFilterNode | null;
}

/**
 * Configuración de fade por defecto
 */
const DEFAULT_FADE_CONFIG: SupraliminalFadeConfig = {
  fadeInDuration: 0.05,
  fadeOutDuration: 0.1,
  fadeType: 'exponential',
};

/**
 * Clase principal del motor supraliminal
 */
export class SupraliminalEngine {
  // ═══════════════════════════════════════════════════════════════
  // 1. VARIABLES PRIVADAS
  // ═══════════════════════════════════════════════════════════════

  private context: AudioContext | null;
  private externalContext: boolean;

  /**
   * Mapa de capas: ID -> Configuración
   */
  private layers: Map<string, SupraliminalLayerConfig>;

  /**
   * Nodos activos: ID -> Nodos de audio
   */
  private activeNodes: Map<string, LayerNodes>;

  /**
   * Pool de nodos reutilizables (optimización de memoria)
   */
  private nodePool: {
    gains: GainNode[];
    panners: StereoPannerNode[];
    filters: BiquadFilterNode[];
  };

  /**
   * Nodos maestros
   */
  private masterGain: GainNode | null;
  private outputNode: GainNode | null;

  /**
   * Estado
   */
  private isPlaying: boolean;
  private masterVolume: number;

  /**
   * Performance tracking
   */
  private performanceMetrics: {
    lastUpdateTime: number;
    frameCount: number;
  };

  // ═══════════════════════════════════════════════════════════════
  // 2. CONSTRUCTOR (Sin parámetros de propiedad)
  // ═══════════════════════════════════════════════════════════════

  constructor(sharedContext?: AudioContext) {
    // Inicializar todas las propiedades explícitamente
    this.context = null;
    this.externalContext = false;
    this.layers = new Map();
    this.activeNodes = new Map();
    this.nodePool = {
      gains: [],
      panners: [],
      filters: [],
    };
    this.masterGain = null;
    this.outputNode = null;
    this.isPlaying = false;
    this.masterVolume = 1.0;
    this.performanceMetrics = {
      lastUpdateTime: 0,
      frameCount: 0,
    };

    // Asignar contexto compartido si existe
    if (sharedContext) {
      this.context = sharedContext;
      this.externalContext = true;
      this.log('Inicializado con contexto compartido');
    } else {
      this.log('Inicializado (contexto propio)');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. INICIALIZACIÓN
  // ═══════════════════════════════════════════════════════════════

  private async init(): Promise<void> {
    // Si usa contexto externo y está listo, solo inicializar nodos
    if (this.externalContext && this.context) {
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      this.initializeNodes();
      return;
    }

    // Si ya tiene contexto, verificar estado
    if (this.context) {
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      return;
    }

    try {
      // Crear nuevo contexto
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

      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      this.initializeNodes();

      this.log('AudioContext inicializado', {
        sampleRate: this.context.sampleRate,
        state: this.context.state,
      });

    } catch (error) {
      throw new AudioEngineError(
        'Error al inicializar motor supraliminal',
        ErrorCode.CONTEXT_NOT_INITIALIZED,
        error
      );
    }
  }

  /**
   * Inicializa los nodos maestros
   */
  private initializeNodes(): void {
    if (!this.context) return;

    // Master Gain
    if (!this.masterGain) {
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 1.0;
    }

    // Output Node
    if (!this.outputNode) {
      this.outputNode = this.context.createGain();
      this.outputNode.gain.value = 1.0;
    }

    // Conectar cadena maestra
    this.masterGain.connect(this.outputNode);

    // Si no usa contexto externo, conectar a destination
    if (!this.externalContext) {
      this.outputNode.connect(this.context.destination);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. GESTIÓN DE CAPAS (CRUD)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Agrega una nueva capa al motor
   * 
   * MEJORA: Ahora acepta configuración de filtro y fade
   */
  public async addLayer(
    file: File,
    options: Partial<Omit<SupraliminalLayerConfig, 'id' | 'buffer'>> = {}
  ): Promise<SupraliminalLayerConfig> {
    await this.init();

    if (!this.context) {
      throw new AudioEngineError(
        'Contexto no inicializado',
        ErrorCode.CONTEXT_NOT_INITIALIZED
      );
    }

    try {
      // Decodificar audio
      this.log(`Cargando archivo: ${file.name}`);
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

      // Crear configuración de capa
      const newLayer: SupraliminalLayerConfig = {
        id: crypto.randomUUID(),
        name: options.name || file.name,
        buffer: audioBuffer,
        playbackRate: options.playbackRate ?? 1.0,
        pan: options.pan ?? 0,
        volume: options.volume ?? 1.0,
        startTimeOffset: options.startTimeOffset ?? 0,
        enabled: options.enabled ?? true,
        filter: options.filter,
        fade: options.fade || DEFAULT_FADE_CONFIG,
      };

      this.layers.set(newLayer.id, newLayer);

      this.log(`Capa agregada: ${newLayer.name}`, {
        id: newLayer.id,
        playbackRate: newLayer.playbackRate,
        pan: newLayer.pan,
        duration: audioBuffer.duration,
        hasFilter: !!newLayer.filter,
      });

      // Si ya está reproduciendo, reiniciar para incluir nueva capa
      if (this.isPlaying) {
        await this.restart();
      }

      return newLayer;

    } catch (error) {
      throw new AudioEngineError(
        'Error al cargar archivo de audio',
        ErrorCode.FILE_LOAD_ERROR,
        error
      );
    }
  }

  /**
   * Carga capa desde URL
   */
  public async addLayerFromURL(
    url: string,
    options: Partial<Omit<SupraliminalLayerConfig, 'id' | 'buffer'>> = {}
  ): Promise<SupraliminalLayerConfig> {
    await this.init();

    if (!this.context) {
      throw new AudioEngineError(
        'Contexto no inicializado',
        ErrorCode.CONTEXT_NOT_INITIALIZED
      );
    }

    try {
      this.log(`Cargando desde URL: ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

      const fileName = url.split('/').pop() || 'audio';

      const newLayer: SupraliminalLayerConfig = {
        id: crypto.randomUUID(),
        name: options.name || fileName,
        buffer: audioBuffer,
        playbackRate: options.playbackRate ?? 1.0,
        pan: options.pan ?? 0,
        volume: options.volume ?? 1.0,
        startTimeOffset: options.startTimeOffset ?? 0,
        enabled: options.enabled ?? true,
        filter: options.filter,
        fade: options.fade || DEFAULT_FADE_CONFIG,
      };

      this.layers.set(newLayer.id, newLayer);

      this.log(`Capa agregada desde URL: ${newLayer.name}`, {
        id: newLayer.id,
      });

      if (this.isPlaying) {
        await this.restart();
      }

      return newLayer;

    } catch (error) {
      throw new AudioEngineError(
        'Error al cargar audio desde URL',
        ErrorCode.FILE_LOAD_ERROR,
        error
      );
    }
  }

  /**
   * Elimina una capa
   */
  public removeLayer(id: string): void {
    if (!this.layers.has(id)) {
      this.log(`Capa no encontrada: ${id}`, null, 'warn');
      return;
    }

    // Detener nodos activos de esta capa
    this.stopLayerNodes(id);

    // Eliminar configuración
    this.layers.delete(id);

    this.log(`Capa eliminada: ${id}`);

    // Si está reproduciendo, reiniciar
    if (this.isPlaying) {
      this.restart();
    }
  }

  /**
   * MEJORA: Actualiza parámetros de una capa en tiempo real
   * Ahora incluye soporte para actualizar filtros
   */
  public updateLayer(
    id: string,
    updates: Partial<SupraliminalLayerConfig>
  ): void {
    const layer = this.layers.get(id);
    if (!layer || !this.context) {
      this.log(`No se puede actualizar capa: ${id}`, null, 'warn');
      return;
    }

    // Actualizar configuración almacenada
    const updatedLayer = { ...layer, ...updates };
    this.layers.set(id, updatedLayer);

    // Si está sonando, actualizar nodos en vivo
    const activeNode = this.activeNodes.get(id);
    if (!activeNode) return;

    const now = this.context.currentTime;

    // Actualizar volumen (con rampa suave)
    if (updates.volume !== undefined) {
      activeNode.gain.gain.cancelScheduledValues(now);
      activeNode.gain.gain.setValueAtTime(activeNode.gain.gain.value, now);
      activeNode.gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, updates.volume),
        now + 0.1
      );
    }

    // Actualizar pan (con rampa suave)
    if (updates.pan !== undefined) {
      activeNode.panner.pan.cancelScheduledValues(now);
      activeNode.panner.pan.setValueAtTime(activeNode.panner.pan.value, now);
      activeNode.panner.pan.linearRampToValueAtTime(updates.pan, now + 0.1);
    }

    // Actualizar velocidad
    if (updates.playbackRate !== undefined) {
      activeNode.source.playbackRate.setValueAtTime(updates.playbackRate, now);
    }

    // MEJORA: Actualizar filtro en tiempo real
    if (updates.filter && activeNode.filter) {
      this.updateFilterInRealTime(activeNode.filter, updates.filter, now);
    }

    this.log(`Capa actualizada en tiempo real: ${id}`, updates);
  }

  /**
   * MEJORA: Actualiza parámetros de filtro en tiempo real
   */
  private updateFilterInRealTime(
    filter: BiquadFilterNode,
    config: SupraliminalFilterConfig,
    startTime: number
  ): void {
    const rampTime = 0.1;

    // Actualizar tipo de filtro
    if (config.type) {
      filter.type = config.type;
    }

    // Actualizar frecuencia (con rampa)
    if (config.frequency !== undefined) {
      filter.frequency.cancelScheduledValues(startTime);
      filter.frequency.setValueAtTime(filter.frequency.value, startTime);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(20, config.frequency),
        startTime + rampTime
      );
    }

    // Actualizar Q (con rampa)
    if (config.Q !== undefined) {
      filter.Q.cancelScheduledValues(startTime);
      filter.Q.setValueAtTime(filter.Q.value, startTime);
      filter.Q.linearRampToValueAtTime(config.Q, startTime + rampTime);
    }

    // Actualizar ganancia (con rampa)
    if (config.gain !== undefined) {
      filter.gain.cancelScheduledValues(startTime);
      filter.gain.setValueAtTime(filter.gain.value, startTime);
      filter.gain.linearRampToValueAtTime(config.gain, startTime + rampTime);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. REPRODUCCIÓN (La Orquesta)
  // ═══════════════════════════════════════════════════════════════

  /**
   * MEJORA: Sistema de reproducción optimizado con fades y filtros
   */
  public async play(): Promise<void> {
    await this.init();

    if (this.isPlaying) {
      await this.stop();
    }

    if (!this.context || !this.masterGain) {
      throw new AudioEngineError(
        'Contexto no inicializado',
        ErrorCode.CONTEXT_NOT_INITIALIZED
      );
    }

    const now = this.context.currentTime;
    let activatedLayers = 0;

    // Recorrer cada capa habilitada
    this.layers.forEach((layer) => {
      if (!layer.enabled || !this.context || !this.masterGain) return;

      try {
        // Crear nodos para esta capa
        const nodes = this.createLayerNodes(layer);

        // MEJORA: Aplicar fade in exponencial
        this.applyFadeIn(nodes.gain, layer.fade || DEFAULT_FADE_CONFIG, now);

        // Iniciar reproducción con offset
        nodes.source.start(now + layer.startTimeOffset);

        // Guardar referencia
        this.activeNodes.set(layer.id, nodes);
        activatedLayers++;

      } catch (error) {
        this.log(`Error al activar capa ${layer.name}:`, error, 'error');
      }
    });

    this.isPlaying = true;
    this.performanceMetrics.lastUpdateTime = now;

    this.log(`Reproduciendo ${activatedLayers} capas activas`, {
      totalLayers: this.layers.size,
      activeNodes: this.activeNodes.size,
    });
  }

  /**
   * MEJORA: Crea y conecta todos los nodos para una capa
   * Incluye filtro individual si está configurado
   */
  private createLayerNodes(layer: SupraliminalLayerConfig): LayerNodes {
    if (!this.context || !this.masterGain) {
      throw new Error('Contexto no disponible');
    }

    // 1. SOURCE (BufferSource)
    const source = this.context.createBufferSource();
    source.buffer = layer.buffer;
    source.loop = true;
    source.playbackRate.value = layer.playbackRate;

    // 2. GAIN (Volumen individual)
    const gain = this.getOrCreateGainNode();
    gain.gain.value = 0.0001; // Empezar en silencio para fade in

    // 3. FILTER (Opcional - MEJORA)
    let filter: BiquadFilterNode | null = null;
    if (layer.filter) {
      filter = this.getOrCreateFilterNode();
      this.configureFilter(filter, layer.filter);
    }

    // 4. PANNER (Posición estereofónica)
    const panner = this.getOrCreatePannerNode();
    panner.pan.value = layer.pan;

    // ─────────────────────────────────────────────────────────
    // CADENA DE CONEXIÓN
    // ─────────────────────────────────────────────────────────
    // Source -> Gain -> [Filter?] -> Panner -> Master
    
    source.connect(gain);

    if (filter) {
      gain.connect(filter);
      filter.connect(panner);
    } else {
      gain.connect(panner);
    }

    panner.connect(this.masterGain);

    return {
      source,
      gain,
      panner,
      filter,
    };
  }

  /**
   * MEJORA: Configura un filtro con los parámetros dados
   */
  private configureFilter(
    filter: BiquadFilterNode,
    config: SupraliminalFilterConfig
  ): void {
    filter.type = config.type;
    filter.frequency.value = config.frequency;
    filter.Q.value = config.Q;
    filter.gain.value = config.gain;
  }

  /**
   * MEJORA: Aplica fade in exponencial para evitar clicks
   */
  private applyFadeIn(
    gainNode: GainNode,
    fadeConfig: SupraliminalFadeConfig,
    startTime: number
  ): void {
    const targetVolume = gainNode.gain.value === 0.0001 ? 1.0 : gainNode.gain.value;

    if (fadeConfig.fadeType === 'exponential') {
      // Fade exponencial (más natural al oído)
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(
        targetVolume,
        startTime + fadeConfig.fadeInDuration
      );
    } else {
      // Fade lineal
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.linearRampToValueAtTime(
        targetVolume,
        startTime + fadeConfig.fadeInDuration
      );
    }
  }

  /**
   * MEJORA: Aplica fade out exponencial
   */
  private applyFadeOut(
    gainNode: GainNode,
    fadeConfig: SupraliminalFadeConfig,
    startTime: number
  ): void {
    const currentVolume = gainNode.gain.value;

    if (fadeConfig.fadeType === 'exponential') {
      gainNode.gain.cancelScheduledValues(startTime);
      gainNode.gain.setValueAtTime(currentVolume, startTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        startTime + fadeConfig.fadeOutDuration
      );
    } else {
      gainNode.gain.cancelScheduledValues(startTime);
      gainNode.gain.setValueAtTime(currentVolume, startTime);
      gainNode.gain.linearRampToValueAtTime(
        0.0001,
        startTime + fadeConfig.fadeOutDuration
      );
    }
  }

  /**
   * MEJORA: Detiene con fade out suave
   */
  public async stop(): Promise<void> {
    if (!this.isPlaying || !this.context) return;

    const now = this.context.currentTime;
    let maxFadeOutDuration = 0;

    // Aplicar fade out a todas las capas activas
    this.activeNodes.forEach((nodes, id) => {
      const layer = this.layers.get(id);
      if (!layer) return;

      const fadeConfig = layer.fade || DEFAULT_FADE_CONFIG;
      this.applyFadeOut(nodes.gain, fadeConfig, now);

      maxFadeOutDuration = Math.max(maxFadeOutDuration, fadeConfig.fadeOutDuration);
    });

    // Esperar a que terminen los fades
    await this.delay((maxFadeOutDuration * 1000) + 50);

    // Detener y limpiar todos los nodos
    this.activeNodes.forEach((_nodes, id) => {
      this.stopLayerNodes(id);
    });

    this.activeNodes.clear();
    this.isPlaying = false;

    this.log('Motor detenido');
  }

  /**
   * Detiene los nodos de una capa específica
   */
  private stopLayerNodes(id: string): void {
    const nodes = this.activeNodes.get(id);
    if (!nodes) return;

    try {
      // Detener source
      nodes.source.stop();
      nodes.source.disconnect();

      // Desconectar gain
      nodes.gain.disconnect();

      // Devolver al pool
      this.returnNodeToPool(nodes.gain, 'gain');

      // Desconectar panner
      nodes.panner.disconnect();
      this.returnNodeToPool(nodes.panner, 'panner');

      // Desconectar filtro si existe
      if (nodes.filter) {
        nodes.filter.disconnect();
        this.returnNodeToPool(nodes.filter, 'filter');
      }

      this.activeNodes.delete(id);

    } catch (error) {
      this.log(`Error al detener nodos de capa ${id}:`, error, 'error');
    }
  }

  /**
   * Reinicia la reproducción
   */
  private async restart(): Promise<void> {
    await this.stop();
    await this.delay(100);
    await this.play();
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. OPTIMIZACIÓN: POOL DE NODOS REUTILIZABLES
  // ═══════════════════════════════════════════════════════════════

  /**
   * MEJORA: Obtiene o crea un GainNode (desde pool si está disponible)
   */
  private getOrCreateGainNode(): GainNode {
    if (!this.context) throw new Error('Contexto no disponible');

    // Intentar obtener del pool
    const pooledNode = this.nodePool.gains.pop();
    if (pooledNode) {
      // Resetear valores
      pooledNode.gain.value = 1.0;
      return pooledNode;
    }

    // Crear nuevo si el pool está vacío
    return this.context.createGain();
  }

  /**
   * MEJORA: Obtiene o crea un StereoPannerNode
   */
  private getOrCreatePannerNode(): StereoPannerNode {
    if (!this.context) throw new Error('Contexto no disponible');

    const pooledNode = this.nodePool.panners.pop();
    if (pooledNode) {
      pooledNode.pan.value = 0;
      return pooledNode;
    }

    return this.context.createStereoPanner();
  }

  /**
   * MEJORA: Obtiene o crea un BiquadFilterNode
   */
  private getOrCreateFilterNode(): BiquadFilterNode {
    if (!this.context) throw new Error('Contexto no disponible');

    const pooledNode = this.nodePool.filters.pop();
    if (pooledNode) {
      // Resetear a configuración por defecto
      pooledNode.type = 'lowpass';
      pooledNode.frequency.value = 20000;
      pooledNode.Q.value = 1;
      pooledNode.gain.value = 0;
      return pooledNode;
    }

    return this.context.createBiquadFilter();
  }

  /**
   * MEJORA: Devuelve un nodo al pool para reutilización
   */
  private returnNodeToPool(
    node: GainNode | StereoPannerNode | BiquadFilterNode,
    type: 'gain' | 'panner' | 'filter'
  ): void {
    // Limitar tamaño del pool para evitar uso excesivo de memoria
    const MAX_POOL_SIZE = 20;

    if (type === 'gain' && node instanceof GainNode) {
      if (this.nodePool.gains.length < MAX_POOL_SIZE) {
        this.nodePool.gains.push(node);
      }
    } else if (type === 'panner' && node instanceof StereoPannerNode) {
      if (this.nodePool.panners.length < MAX_POOL_SIZE) {
        this.nodePool.panners.push(node);
      }
    } else if (type === 'filter' && node instanceof BiquadFilterNode) {
      if (this.nodePool.filters.length < MAX_POOL_SIZE) {
        this.nodePool.filters.push(node);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. CONTROL MAESTRO Y GETTERS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Ajusta el volumen maestro (suave)
   */
  public setMasterVolume(value: number): void {
    if (!this.masterGain || !this.context) return;

    const clamped = Math.max(0, Math.min(1, value));
    this.masterVolume = clamped;

    const now = this.context.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, clamped),
      now + 0.1
    );
  }

  /**
   * Obtiene volumen maestro actual
   */
  public getMasterVolume(): number {
    return this.masterVolume;
  }

  /**
   * Obtiene lista de capas
   */
  public getLayers(): SupraliminalLayerConfig[] {
    return Array.from(this.layers.values());
  }

  /**
   * Obtiene configuración de una capa específica
   */
  public getLayer(id: string): SupraliminalLayerConfig | undefined {
    return this.layers.get(id);
  }

  /**
   * Obtiene estado completo
   */
  public getState(): SupraliminalEngineState {
    return {
      layers: this.getLayers(),
      isPlaying: this.isPlaying,
      masterVolume: this.masterVolume,
    };
  }

  /**
   * Verifica si está reproduciendo
   */
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Obtiene número de capas activas
   */
  public getActiveLayerCount(): number {
    return this.activeNodes.size;
  }

  /**
   * Conecta la salida a un destino (para AudioMixer)
   */
  public connectTo(destination: AudioNode): void {
    if (this.outputNode) {
      this.outputNode.connect(destination);
    }
  }

  /**
   * Desconecta la salida
   */
  public disconnect(): void {
    if (this.outputNode) {
      this.outputNode.disconnect();
    }
  }

  /**
   * Obtiene el nodo de salida
   */
  public getOutputNode(): GainNode | null {
    return this.outputNode;
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. PRESETS Y HELPERS
  // ═══════════════════════════════════════════════════════════════

  /**
   * MEJORA: Preset de filtro Low-Pass para enmascaramiento
   */
  public static createLowPassFilter(
    cutoffFrequency: number = 5000
  ): SupraliminalFilterConfig {
    return {
      type: 'lowpass',
      frequency: cutoffFrequency,
      Q: 1,
      gain: 0,
    };
  }

  /**
   * MEJORA: Preset de filtro High-Pass para enmascaramiento
   */
  public static createHighPassFilter(
    cutoffFrequency: number = 200
  ): SupraliminalFilterConfig {
    return {
      type: 'highpass',
      frequency: cutoffFrequency,
      Q: 1,
      gain: 0,
    };
  }

  /**
   * MEJORA: Preset de filtro Band-Pass
   */
  public static createBandPassFilter(
    centerFrequency: number = 1000,
    Q: number = 1
  ): SupraliminalFilterConfig {
    return {
      type: 'bandpass',
      frequency: centerFrequency,
      Q,
      gain: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. LIMPIEZA Y DESTRUCCIÓN
  // ═══════════════════════════════════════════════════════════════

  /**
   * Libera todos los recursos
   */
  public async dispose(): Promise<void> {
    await this.stop();

    // Limpiar layers
    this.layers.clear();

    // Limpiar pool
    this.nodePool.gains = [];
    this.nodePool.panners = [];
    this.nodePool.filters = [];

    // Desconectar nodos maestros
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }

    if (this.outputNode) {
      this.outputNode.disconnect();
      this.outputNode = null;
    }

    // Cerrar contexto solo si no es externo
    if (this.context && !this.externalContext) {
      await this.context.close();
      this.context = null;
    }

    this.log('Motor supraliminal destruido y recursos liberados');
  }

  // ═══════════════════════════════════════════════════════════════
  // 10. UTILIDADES
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

    const prefix = '[SupraliminalEngine]';
    const icons = { info: '🗣️', warn: '⚠️', error: '❌' };
    const icon = icons[level];

    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    logFn(`${prefix} ${icon}`, message, data || '');
  }
}