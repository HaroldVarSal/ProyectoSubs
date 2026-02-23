import { useEffect, useRef, useState } from 'react';
import { AudioMixer } from '../core/audio/AudioMixer';

interface VisualizerProps {
  mixer: AudioMixer;
  width?: number;
  height?: number;
}

/**
 * VISUALIZER - VENTANA AL ESPECTRO ULTRASÓNICO
 * 
 * Traduce frecuencias inaudibles (17.5 kHz) en luz visible.
 * Permite verificar:
 * 1. Que el motor Silent está generando la portadora ultrasónica
 * 2. Que no hay clipping (distorsión)
 * 3. La distribución espectral de las capas supraliminales
 */
export const Visualizer = ({ mixer, width = 600, height = 200 }: VisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [mode, setMode] = useState<'spectrum' | 'waveform'>('spectrum');
  const [isClipping, setIsClipping] = useState(false);

  useEffect(() => {
    let intervalId: number | null = null;
    let started = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    // Función que inicia el bucle de dibujo cuando el mixer esté listo
    const startDrawing = () => {
      if (started) return;
      started = true;

      // Intentar inferir tamaño del buffer a partir del mixer
      const norm = mixer.getNormalizedFrequencySpectrum();
      const bufferLength = norm && norm.length ? norm.length : 1024;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        // Limpiar Canvas y dibujar grid antes de pintar los datos
        canvasCtx.fillStyle = 'rgb(15, 23, 42)';
        canvasCtx.fillRect(0, 0, width, height);
        drawGrid(canvasCtx, width, height);

        if (mode === 'spectrum') {
          mixer.getPostFrequencyData(dataArray);
          drawSpectrum(canvasCtx, dataArray, bufferLength, width, height);
        } else {
          mixer.getPostTimeDomainData(dataArray);
          drawWaveform(canvasCtx, dataArray, bufferLength, width, height);
        }

        animationRef.current = requestAnimationFrame(draw);
      };

      draw();
    };

    // Si el mixer ya está listo, iniciar inmediatamente. Si no, esperar hasta que lo esté.
    if (mixer.isReady()) {
      startDrawing();
    } else {
      intervalId = window.setInterval(() => {
        if (mixer.isReady()) {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          startDrawing();
        }
      }, 100);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      cancelAnimationFrame(animationRef.current);
    };
  }, [mixer, mode, width, height]);

  // Intervalo separado para chequear clipping sin afectar FPS
  useEffect(() => {
    const clipInterval = setInterval(() => {
      if (mixer && mixer.isReady() && mixer.isClipping()) {
        setIsClipping(true);
        // Apagar el indicador después de un momento
        setTimeout(() => setIsClipping(false), 200);
      }
    }, 100);
    return () => clearInterval(clipInterval);
  }, [mixer]);

  // ═══════════════════════════════════════════════════════════════
  // HELPERS DE DIBUJO
  // ═══════════════════════════════════════════════════════════════

  const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = '#1e293b'; // Slate-800
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Líneas horizontales
    for (let i = 0; i <= h; i += h / 4) {
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
    }
    
    // Líneas verticales
    for (let i = 0; i <= w; i += w / 8) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
    }
    
    ctx.stroke();
  };

  const drawSpectrum = (
    ctx: CanvasRenderingContext2D,
    data: Uint8Array,
    bufferLen: number,
    w: number,
    h: number
  ) => {
    const barWidth = (w / bufferLen) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLen; i++) {
      barHeight = (data[i] / 255) * h;

      // Detectar zona de 17.5 kHz (aproximadamente en el último 15% del espectro)
      // En 44.1 kHz sample rate, 17.5 kHz está cerca del 79% del espectro (17500/22050)
      const isSubliminalZone = i > bufferLen * 0.75;

      if (isSubliminalZone && data[i] > 10) {
        // Magenta neón para la zona ultrasónica (17.5 kHz)
        ctx.fillStyle = 'rgb(255, 0, 255)';
      } else {
        // Gradiente de color para frecuencias audibles
        const r = Math.min(255, barHeight + 25 * (i / bufferLen));
        const g = 50;
        const b = Math.min(255, 250 * (i / bufferLen));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      }

      ctx.fillRect(x, h - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }

    // Etiqueta de zona ultrasónica
    ctx.fillStyle = '#ff00ff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('17.5kHz', w - 65, 18);
    
    // Línea marcadora de zona ultrasónica
    const markerX = w * 0.75;
    ctx.strokeStyle = 'rgba(255, 0, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(markerX, 0);
    ctx.lineTo(markerX, h);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawWaveform = (
    ctx: CanvasRenderingContext2D,
    data: Uint8Array,
    bufferLen: number,
    w: number,
    h: number
  ) => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#38bdf8'; // Sky-400
    ctx.beginPath();

    const sliceWidth = w / bufferLen;
    let x = 0;

    for (let i = 0; i < bufferLen; i++) {
      const v = data[i] / 128.0;
      const y = (v * h) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(w, h / 2);
    ctx.stroke();
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-xl overflow-hidden relative">
      {/* Header del Visualizador */}
      <div className="absolute top-2 left-4 flex space-x-2 z-10">
        <button
          onClick={() => setMode('spectrum')}
          className={`text-xs font-bold px-3 py-1.5 rounded transition-all ${
            mode === 'spectrum'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          ESPECTRO
        </button>
        <button
          onClick={() => setMode('waveform')}
          className={`text-xs font-bold px-3 py-1.5 rounded transition-all ${
            mode === 'waveform'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          ONDA
        </button>
      </div>

      {/* Indicador de Clipping */}
      <div className="absolute top-3 right-4 flex items-center space-x-2 z-10">
        <div
          className={`w-3 h-3 rounded-full shadow-lg transition-all duration-75 ${
            isClipping
              ? 'bg-red-500 shadow-red-500/50 animate-pulse'
              : 'bg-green-900 shadow-green-900/30'
          }`}
        />
        <span
          className={`text-[10px] font-mono font-bold transition-colors ${
            isClipping ? 'text-red-400' : 'text-slate-500'
          }`}
        >
          {isClipping ? 'CLIP!' : 'OK'}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full block"
      />
    </div>
  );
};