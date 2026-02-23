import { useState, useRef, useEffect } from 'react';
import { SilentEngine } from './core/audio/SilentEngine';
import { SupraliminalEngine } from './core/audio/SupraliminalEngine';
import { AudioMixer } from './core/audio/AudioMixer';
import { Visualizer } from './components/Visualizer';
import { type SupraliminalLayerConfig } from './core/audio/types';

function App() {
  // ═══════════════════════════════════════════════════════════════
  // 1. REFERENCIAS AL MOTOR DE AUDIO (Persisten entre renders)
  // ═══════════════════════════════════════════════════════════════
  const mixerRef = useRef<AudioMixer | null>(null);
  const silentRef = useRef<SilentEngine | null>(null);
  const supraRef = useRef<SupraliminalEngine | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // 2. ESTADO DE LA INTERFAZ (Lo que ves en pantalla)
  // ═══════════════════════════════════════════════════════════════
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSilentActive, setIsSilentActive] = useState(false);
  const [layers, setLayers] = useState<SupraliminalLayerConfig[]>([]);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [error, setError] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // 3. INICIALIZACIÓN (Al cargar la página)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    // Instanciamos el Mixer una sola vez al entrar
    mixerRef.current = new AudioMixer();

    // Limpieza al salir
    return () => {
      mixerRef.current?.dispose();
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 4. LÓGICA DE ACTIVACIÓN (El "Despertador" del Audio)
  // ═══════════════════════════════════════════════════════════════
  const activateAudioSystem = async () => {
    if (isReady) return true; // Si ya está listo, no hacemos nada

    try {
      console.log("🔄 Activando sistema de audio...");
      const mixer = mixerRef.current;
      if (!mixer) throw new Error("Mixer no inicializado");

      // 1. Iniciar Mixer y Contexto
      await mixer.init();
      await mixer.resumeContext();

      // 2. Obtener el contexto compartido
      const ctx = mixer.getContext();
      if (!ctx) throw new Error("No se pudo obtener AudioContext");

      // 3. Crear e interconectar los motores
      if (!silentRef.current) {
        silentRef.current = new SilentEngine(ctx);
        mixer.connectEngine(silentRef.current, { id: 'silent', name: 'Portadora 17.5kHz', volume: 0.3 });
      }

      if (!supraRef.current) {
        supraRef.current = new SupraliminalEngine(ctx);
        mixer.connectEngine(supraRef.current, { id: 'supra', name: 'Motor Supraliminal', volume: 0.8 });
      }

      // 4. Configurar volumen inicial
      mixer.setMasterVolume(masterVolume);

      setIsReady(true);
      console.log("✅ Sistema activado correctamente");
      return true;

    } catch (err) {
      console.error("❌ Error crítico:", err);
      setError("Error al iniciar el motor de audio. Revisa la consola.");
      return false;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 5. MANEJADORES DE EVENTOS (Botones y Sliders)
  // ═══════════════════════════════════════════════════════════════

  // A. Carga de Archivos (Maneja la inicialización automática)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      
      // 1. Aseguramos que el sistema esté encendido
      const ready = await activateAudioSystem();
      if (!ready) return;

      // 2. Obtenemos el motor ya garantizado
      const supra = supraRef.current;
      if (!supra) throw new Error("Motor Supraliminal no disponible");

      // 3. Cargamos la capa
      console.log("📂 Cargando archivo:", file.name);
      await supra.addLayer(file, {
        playbackRate: 1.5,
        pan: (Math.random() * 2) - 1, // Paneo aleatorio
        volume: 0.7
      });

      // 4. Actualizamos la UI
      setLayers([...supra.getLayers()]);
      e.target.value = ''; // Limpiar input para permitir subir el mismo archivo
      
    } catch (err: any) {
      setError(`Error al cargar audio: ${err.message}`);
    }
  };

  // B. Botón Principal (Iniciar/Detener Sesión)
  const handleToggleSession = async () => {
    try {
      if (!isReady) {
        await activateAudioSystem();
        // Esperamos un poco para que el usuario note que se activó
        return; 
      }

      const mixer = mixerRef.current;
      const silent = silentRef.current;
      const supra = supraRef.current;

      if (!mixer || !silent || !supra) return;

      if (isPlaying) {
        // DETENER
        await silent.stop();
        await supra.stop();
        setIsPlaying(false);
      } else {
        // INICIAR
        await mixer.resumeContext(); // Siempre asegurar contexto activo
        if (isSilentActive) await silent.play();
        if (layers.length > 0) await supra.play();
        setIsPlaying(true);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // C. Toggle Silent (Portadora)
  const handleSilentToggle = async (checked: boolean) => {
    setIsSilentActive(checked);
    if (isPlaying && silentRef.current) {
      if (checked) await silentRef.current.play();
      else await silentRef.current.stop();
    }
  };

  // D. Eliminar Capa
  const handleRemoveLayer = (id: string) => {
    if (supraRef.current) {
      supraRef.current.removeLayer(id);
      setLayers([...supraRef.current.getLayers()]);
    }
  };

  // E. Control de Volumen Maestro
  const handleVolumeChange = (val: number) => {
    setMasterVolume(val);
    if (mixerRef.current) {
      mixerRef.current.setMasterVolume(val);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 6. INTERFAZ GRÁFICA (UI)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-6 selection:bg-purple-500/30">
      
      {/* Header */}
      <header className="max-w-5xl mx-auto mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 mb-2 filter drop-shadow-lg">
          PSICOACÚSTICA LAB
        </h1>
        <p className="text-slate-500 text-xs tracking-[0.4em] uppercase font-bold">
          Estación de Ingeniería de Audio v1.0
        </p>
      </header>

      {/* Alerta de Error */}
      {error && (
        <div className="max-w-xl mx-auto mb-6 p-4 bg-red-950/50 border border-red-500/50 rounded-xl flex items-center gap-3 animate-bounce-short">
          <span className="text-2xl">⚠️</span>
          <p className="text-red-300 text-sm font-medium">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-white">✕</button>
        </div>
      )}

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMNA IZQUIERDA: VISUALIZADOR Y CONTROLES MAESTROS (4 columnas) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Tarjeta Visualizador */}
          <div className="bg-slate-900 rounded-2xl p-1 border border-slate-800 shadow-2xl shadow-black/50">
            <div className="bg-slate-950 rounded-xl overflow-hidden relative">
              {mixerRef.current && <Visualizer mixer={mixerRef.current} height={200} />}
              {/* Overlay si no está listo */}
              {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10 backdrop-blur-sm">
                  <span className="text-xs font-mono text-slate-500 animate-pulse">ESPERANDO SISTEMA...</span>
                </div>
              )}
            </div>
            <div className="p-3 flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase">
              <span>RTA Spectrum</span>
              <span className={isReady ? "text-green-500" : "text-orange-500"}>
                {isReady ? "● ONLINE" : "○ STANDBY"}
              </span>
            </div>
          </div>

          {/* Tarjeta de Control Principal */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
            
            {/* Volumen Maestro */}
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wide">
                <span>Volumen Maestro</span>
                <span>{Math.round(masterVolume * 100)}%</span>
              </div>
              <input 
                type="range" min="0" max="1.5" step="0.01"
                value={masterVolume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Switch Portadora */}
            <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-800">
              <div>
                <div className="text-sm font-bold text-slate-200">Portadora Silent</div>
                <div className="text-[10px] text-purple-400 font-mono">17.5 kHz (Inaudible)</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={isSilentActive}
                  onChange={(e) => handleSilentToggle(e.target.checked)}
                  disabled={!isReady}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {/* Botón de Acción */}
            <button 
              onClick={handleToggleSession}
              className={`w-full py-4 rounded-xl font-black text-lg tracking-wider transition-all transform active:scale-95 shadow-lg ${
                !isReady 
                  ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  : isPlaying 
                    ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20' 
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500'
              }`}
            >
              {!isReady ? 'ACTIVAR SISTEMA' : isPlaying ? 'DETENER SESIÓN' : 'INICIAR SESIÓN'}
            </button>
          </div>
        </div>

        {/* COLUMNA DERECHA: MATRIZ SUPRALIMINAL (8 columnas) */}
        <div className="lg:col-span-8 bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl flex flex-col h-[600px]">
          
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Matriz Supraliminal
              </h2>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                {layers.length} CAPAS ACTIVAS | SATURACIÓN COGNITIVA
              </p>
            </div>
            
            {/* Input de Carga (Siempre habilitado) */}
            <label className="group relative bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                <span>+ CARGAR AUDIO</span>
              </span>
              <input 
                type="file" 
                hidden 
                accept=".mp3,.wav,.ogg,.m4a" 
                onChange={handleFileUpload}
              />
              <div className="absolute inset-0 bg-cyan-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            </label>
          </div>

          {/* Lista de Capas */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
            {layers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-600 bg-slate-950/30">
                <p className="text-4xl mb-4">📂</p>
                <p className="text-sm font-medium">Matriz Vacía</p>
                <p className="text-xs mt-1 opacity-70">Sube audios para iniciar la saturación</p>
              </div>
            ) : (
              layers.map((layer) => (
                <div key={layer.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-slate-600 transition-colors group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center font-mono text-cyan-400 font-bold border border-slate-800 shadow-inner">
                        {layer.playbackRate}x
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-200 text-sm truncate max-w-[200px] md:max-w-[300px]">
                          {layer.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-slate-500">
                          <span className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${layer.pan < 0 ? 'bg-purple-500' : layer.pan > 0 ? 'bg-blue-500' : 'bg-slate-500'}`}></span>
                            PAN: {Math.round(layer.pan * 100)}%
                          </span>
                          <span>VOL: {Math.round(layer.volume * 100)}%</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemoveLayer(layer.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {/* Controles de Capa (Simplificados para MVP) */}
                  <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-900/50 w-full relative">
                      {/* Aquí iría una visualización mini de la onda en el futuro */}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;