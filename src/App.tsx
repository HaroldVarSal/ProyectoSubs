import { useState, useRef } from 'react';
import { SilentEngine } from './core/audio/SilentEngine';
import { type AMModulationConfig, type AudioFileInfo } from './core/audio/types';

function App() {
  // 1. Referencia al motor (para que no se reinicie entre renders)
  const engineRef = useRef<SilentEngine | null>(null);

  // 2. Estados de la interfaz
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileInfo, setFileInfo] = useState<AudioFileInfo | null>(null);
  const [isAMActive, setIsAMActive] = useState(false);

  // 3. Inicializar el motor si no existe
  const getEngine = () => {
    if (!engineRef.current) {
      engineRef.current = new SilentEngine();
    }
    return engineRef.current;
  };

  // 4. Acciones
  const handleToggleCarrier = async () => {
    const engine = getEngine();
    if (isPlaying) {
      await engine.stop();
      setIsPlaying(false);
      setIsAMActive(false);
    } else {
      await engine.play(0.5); // 17.5 kHz con LFO de 0.5Hz
      setIsPlaying(true);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const engine = getEngine();
      try {
        const info = await engine.loadAudioFile(file);
        setFileInfo(info);
      } catch (err) {
        alert("Error al cargar el audio");
      }
    }
  };

  const handlePlayAM = async () => {
    if (!fileInfo) return;
    const engine = getEngine();
    
    const config: Partial<AMModulationConfig> = {
      modulationDepth: 1.0,
      messageGain: 0.8
    };

    await engine.playWithAM(config, true); // Reproducir en bucle
    setIsPlaying(true);
    setIsAMActive(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center justify-center font-sans">
      <h1 className="text-3xl font-bold mb-8 text-purple-400">PsicoAcústica Lab - Test</h1>
      
      <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 w-full max-w-md space-y-6">
        
        {/* Sección de la Portadora */}
        <div className="space-y-2">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold">Motor Silencioso (17.5 kHz)</p>
          <button 
            onClick={handleToggleCarrier}
            className={`w-full py-3 rounded-lg font-bold transition-colors ${
              isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isPlaying ? 'DETENER TODO' : 'ENCENDER PORTADORA'}
          </button>
        </div>

        {/* Sección de Archivo */}
        <div className="space-y-4 border-t border-slate-700 pt-4">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold">Mensaje Subliminal (AM)</p>
          
          <input 
            type="file" 
            accept="audio/*" 
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-900 file:text-purple-200 hover:file:bg-purple-800"
          />

          {fileInfo && (
            <div className="bg-slate-900/50 p-3 rounded text-xs space-y-1 text-slate-300">
              <p>📄 <strong>Archivo:</strong> {fileInfo.name}</p>
              <p>⏱️ <strong>Duración:</strong> {fileInfo.duration.toFixed(2)}s</p>
              <button 
                onClick={handlePlayAM}
                className={`w-full mt-2 py-2 rounded font-bold ${
                  isAMActive ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isAMActive ? 'MODULANDO MENSAJE...' : 'REPRODUCIR CON AM'}
              </button>
            </div>
          )}
        </div>

        {/* Estado Visual */}
        <div className="flex items-center justify-center space-x-2 pt-4">
          <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-500">{isPlaying ? 'TRANSMITIENDO ULTRASONIDO' : 'MOTOR EN ESPERA'}</span>
        </div>

      </div>
      
      <p className="mt-8 text-slate-500 text-xs text-center max-w-xs">
        Nota: La frecuencia de 17.5 kHz es inaudible para la mayoría de los adultos. 
        Usa audífonos de buena calidad para asegurar la respuesta de frecuencia.
      </p>
    </div>
  );
}

export default App;