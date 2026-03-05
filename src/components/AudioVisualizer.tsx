import React, { useEffect, useRef } from 'react';

interface Props {
  stream: MediaStream | null;
  isRecording: boolean;
}

export function AudioVisualizer({ stream, isRecording }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!stream || !isRecording) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw a flat line when inactive
      ctx.fillStyle = '#475569'; // slate-600
      ctx.beginPath();
      ctx.roundRect(0, canvas.height / 2 - 2, canvas.width, 4, 2);
      ctx.fill();
      return;
    }

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const numBars = 20;
      const barWidth = (canvas.width / numBars) - 4;
      let x = 2;

      for (let i = 0; i < numBars; i++) {
        // Focus on lower frequencies for voice
        const dataIndex = Math.floor(i * (bufferLength / 3) / numBars); 
        const value = dataArray[dataIndex];
        
        const percent = value / 255;
        // Minimum height of 4px, max of canvas height
        const barHeight = Math.max(4, percent * canvas.height);
        const y = (canvas.height - barHeight) / 2;

        // Color gradient based on intensity
        ctx.fillStyle = percent > 0.7 ? '#10b981' : percent > 0.4 ? '#34d399' : '#6ee7b7';
        
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        ctx.fill();

        x += barWidth + 4;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioCtx.state !== 'closed') {
        audioCtx.close().catch(console.error);
      }
    };
  }, [stream, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={60}
      className="w-full max-w-[240px] h-[60px] mx-auto transition-opacity duration-300"
      style={{ opacity: isRecording ? 1 : 0.3 }}
    />
  );
}
