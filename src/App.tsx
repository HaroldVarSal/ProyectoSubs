import { useBinaural } from './hooks/useBinaural';
import { BrainwaveState } from './core/audio/types';

function App() {
  // Conectamos nuestro Hook
  const { playPreset, stop, setVolume, isPlaying, volume } = useBinaural();

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-alchemy-dark text-white gap-8">
      
      {/* TÍTULO */}
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tighter text-neon-cyan mb-2 drop-shadow-[0_0_15px_rgba(0,229,255,0.5)]">
          TEST DE MOTOR BINAURAL
        </h1>
        <p className="text-gray-400">Ponte auriculares para probar el efecto estéreo</p>
      </div>

      {/* VISUALIZADOR DE ESTADO */}
      <div className={`w-32 h-32 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
        isPlaying 
          ? 'border-neon-purple shadow-[0_0_50px_rgba(123,97,255,0.4)] bg-neon-purple/10' 
          : 'border-gray-700 bg-transparent'
      }`}>
        <span className="text-2xl animate-pulse">
          {isPlaying ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* CONTROLES DE FRECUENCIA */}
      <div className="flex gap-4">
        <button 
          onClick={() => playPreset(BrainwaveState.ALPHA)}
          className="px-6 py-3 bg-gray-800 border border-gray-600 rounded hover:border-neon-cyan hover:text-neon-cyan transition-all"
        >
          Alpha (Relajación)
        </button>
        
        <button 
          onClick={() => playPreset(BrainwaveState.THETA)}
          className="px-6 py-3 bg-gray-800 border border-gray-600 rounded hover:border-neon-purple hover:text-neon-purple transition-all"
        >
          Theta (Meditación)
        </button>
      </div>

      {/* CONTROL DE VOLUMEN */}
      <div className="flex flex-col items-center gap-2 w-64">
        <label className="text-xs tracking-widest uppercase text-gray-500">Volumen Maestro</label>
        <input 
          type="range" 
          min="0" max="100" 
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
        />
        <span className="text-xs font-mono">{volume}%</span>
      </div>

      {/* BOTÓN DE PARO DE EMERGENCIA */}
      <button 
        onClick={stop}
        className="mt-8 px-8 py-2 text-red-500 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors uppercase text-xs tracking-widest"
      >
        Detener Motor
      </button>

    </div>
  )
}

export default App
