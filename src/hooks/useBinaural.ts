import { useEffect, useRef, useState } from 'react';
import { BinauralEngine } from '../core/audio/BinauralEngine';
import { BrainwaveState } from '../core/audio/types';

export function useBinaural() {
  // Mantenemos el motor en una "ref" para que no se reinicie cada vez que React renderiza
  const engineRef = useRef<BinauralEngine | null>(null);
  
  // Estado visual para la interfaz
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(50); // 0-100%

  // 1. Nacer y Morir (Ciclo de vida)
  useEffect(() => {
    // Crear el motor al cargar la página
    engineRef.current = new BinauralEngine();

    // Limpiar memoria al cerrar la página
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, []);

  // 2. Acciones Disponibles
  const playFreq = async (carrier: number, beat: number) => {
    if (!engineRef.current) return;
    try {
      await engineRef.current.play(carrier, beat);
      setIsPlaying(true);
    } catch (err) {
      console.error("Error al reproducir:", err);
    }
  };

  const playPreset = async (state: BrainwaveState) => {
    if (!engineRef.current) return;
    try {
      await engineRef.current.playPreset(state);
      setIsPlaying(true);
    } catch (err) {
      console.error("Error preset:", err);
    }
  };

  const stop = async () => {
    if (!engineRef.current) return;
    await engineRef.current.stop();
    setIsPlaying(false);
  };

  const setVolume = (val: number) => {
    if (!engineRef.current) return;
    engineRef.current.setVolume(val);
    setVolumeState(val);
  };

  return {
    playFreq,
    playPreset,
    stop,
    setVolume,
    isPlaying,
    volume
  };
}