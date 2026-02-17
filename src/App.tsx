import { useState, useRef } from 'react';
import { SilentEngine } from './core/audio/SilentEngine';
import { SupraliminalEngine } from './core/audio/SupraliminalEngine';
import { type SupraliminalLayerConfig } from './core/audio/types';

function App() {
  // 1. Referencias a los motores
  const silentRef = useRef(new SilentEngine());
  const supraRef = useRef(new SupraliminalEngine());

  // 2. Estados de la Interfaz
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [supraLayers, setSupraLayers] = useState<SupraliminalLayerConfig[]>([]);
  const [isSilentActive, setIsSilentActive] = useState(false);

  // 3. Funciones del Motor Supraliminal (Día 2)
  const handleAddLayer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await supraRef.current.addLayer(file, {
        playbackRate: 1.5, // Empezamos con saturación 1.5x por defecto
        pan: (Math.random() * 2) - 1, // Posición aleatoria para probar
        volume: 0.7
      });
      setSupraLayers(supraRef.current.getLayers());
      e.target.value = ''; // Limpiar input
    }
  };

  const handleUpdateLayer = (id: string, updates: Partial<SupraliminalLayerConfig>) => {
    supraRef.current.updateLayer(id, updates);
    setSupraLayers(supraRef.current.getLayers());
  };

  const handleRemoveLayer = (id: string) => {
    supraRef.current.removeLayer(id);
    setSupraLayers(supraRef.current.getLayers());
  };

  // 4. Control Maestro (Play/Stop)
  const handleToggleAll = async () => {
    const silent = silentRef.current;
    const supra = supraRef.current;

    if (isPlayingAll) {
    await silent.stop();
    await supra.stop();
    setIsPlayingAll(false);
      
    } else {
      // Iniciar motores
      if (isSilentActive) await silentRef.current.play();
      await supraRef.current.play();
      setIsPlayingAll(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 font-sans">
      <header className="max-w-4xl mx-auto mb-10 text-center">
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500 mb-2">
          PSICOACÚSTICA LAB
        </h1>
        <p className="text-slate-500 text-sm tracking-widest uppercase">Fase 1: Saturación de Ancho de Banda</p>
      </header>

      <main className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* PANEL IZQUIERDO: CONFIGURACIÓN MAESTRA */}
        <div className="md:col-span-1 space-y-6">
          <section className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="text-purple-500">⚙️</span> Master Control
            </h2>
            
            <button 
              onClick={handleToggleAll}
              className={`w-full py-4 rounded-xl font-black text-lg transition-all transform active:scale-95 ${
                isPlayingAll 
                ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
                : 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-500/20'
              }`}
            >
              {isPlayingAll ? 'DETENER SESIÓN' : 'INICIAR SESIÓN'}
            </button>

            <div className="mt-6 space-y-4">
              <label className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                <span className="text-sm font-medium">Portadora 17.5 kHz</span>
                <input 
                  type="checkbox" 
                  checked={isSilentActive} 
                  onChange={(e) => setIsSilentActive(e.target.checked)}
                  className="w-5 h-5 accent-purple-500"
                />
              </label>
            </div>
          </section>
        </div>

        {/* PANEL DERECHO: CAPAS SUPRALIMINALES */}
        <div className="md:col-span-2 space-y-6">
          <section className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold">Capas Supraliminales</h2>
              <label className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors">
                + AGREGAR VOZ
                <input type="file" hidden accept="audio/*" onChange={handleAddLayer} />
              </label>
            </div>

            <div className="space-y-4">
              {supraLayers.length === 0 && (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl text-slate-600">
                  <p>No hay capas activas</p>
                  <p className="text-xs">Sube afirmaciones para saturar el sistema</p>
                </div>
              )}

              {supraLayers.map((layer) => (
                <div key={layer.id} className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-blue-400 text-sm truncate max-w-[150px]">{layer.name}</span>
                    <button onClick={() => handleRemoveLayer(layer.id)} className="text-slate-500 hover:text-red-400">✕</button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Control de Velocidad */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 font-bold">Velocidad: {layer.playbackRate}x</label>
                      <input 
                        type="range" min="0.5" max="2.5" step="0.1"
                        value={layer.playbackRate}
                        onChange={(e) => handleUpdateLayer(layer.id, { playbackRate: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>

                    {/* Control de Pan (Espacio) */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 font-bold">Posición: {layer.pan < 0 ? 'Izq' : layer.pan > 0 ? 'Der' : 'Centro'}</label>
                      <input 
                        type="range" min="-1" max="1" step="0.1"
                        value={layer.pan}
                        onChange={(e) => handleUpdateLayer(layer.id, { pan: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;