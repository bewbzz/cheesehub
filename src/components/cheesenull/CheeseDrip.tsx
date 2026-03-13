import { useEffect, useState, useMemo } from 'react';

interface CheeseDripProps {
  active: boolean;
}

interface Drip {
  id: number;
  left: number;
  width: number;
  delay: number;
  duration: number;
  opacity: number;
}

export function CheeseDrip({ active }: CheeseDripProps) {
  const [visible, setVisible] = useState(false);

  const drips = useMemo<Drip[]>(() => {
    if (!active) return [];
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: 3 + Math.random() * 94,
      width: 6 + Math.random() * 14,
      delay: Math.random() * 0.8,
      duration: 2.5 + Math.random() * 2,
      opacity: 0.7 + Math.random() * 0.3,
    }));
  }, [active]);

  useEffect(() => {
    if (active) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 4500);
      return () => clearTimeout(timer);
    }
  }, [active]);

  if (!visible || drips.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {drips.map((drip) => (
        <div
          key={drip.id}
          className="absolute top-0"
          style={{
            left: `${drip.left}%`,
            width: `${drip.width}px`,
            opacity: drip.opacity,
            animation: `cheese-drip ${drip.duration}s ease-in ${drip.delay}s forwards`,
          }}
        >
          {/* Drip head blob */}
          <div
            className="rounded-full mx-auto"
            style={{
              width: `${drip.width}px`,
              height: `${drip.width * 1.3}px`,
              background: `radial-gradient(ellipse at 40% 30%, hsl(48, 100%, 65%), hsl(42, 90%, 50%) 50%, hsl(38, 80%, 35%))`,
              animation: `cheese-blob ${0.6 + Math.random() * 0.4}s ease-in-out ${drip.delay}s infinite alternate`,
            }}
          />
          {/* Drip trail */}
          <div
            className="mx-auto rounded-b-full"
            style={{
              width: `${drip.width * 0.5}px`,
              height: '80px',
              background: `linear-gradient(to bottom, hsl(42, 90%, 50%), hsl(42, 90%, 50% / 0.3), transparent)`,
              marginTop: '-2px',
            }}
          />
        </div>
      ))}

      <style>{`
        @keyframes cheese-drip {
          0% { transform: translateY(-30px); opacity: 0; }
          8% { opacity: 1; }
          100% { transform: translateY(calc(100vh)); opacity: 0; }
        }
        @keyframes cheese-blob {
          0% { transform: scaleX(1) scaleY(1); }
          100% { transform: scaleX(0.8) scaleY(1.2); }
        }
      `}</style>
    </div>
  );
}
