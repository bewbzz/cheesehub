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
  maxHeight: number;
  swayAmount: number;
  swayDuration: number;
  detaches: boolean;
}

export function CheeseDrip({ active }: CheeseDripProps) {
  const [visible, setVisible] = useState(false);

  const drips = useMemo<Drip[]>(() => {
    if (!active) return [];
    // Cluster drips near edges with a few in the middle
    const positions = [
      2, 6, 11, 16, 25, 40, 55, 72, 84, 89, 94, 97,
    ];
    return positions.map((left, i) => ({
      id: i,
      left: left + (Math.random() - 0.5) * 4,
      width: 12 + Math.random() * 18,
      delay: Math.random() * 2,
      duration: 4 + Math.random() * 4,
      maxHeight: 150 + Math.random() * 250,
      swayAmount: 2 + Math.random() * 4,
      swayDuration: 1.5 + Math.random() * 1.5,
      detaches: Math.random() > 0.6,
    }));
  }, [active]);

  useEffect(() => {
    if (active) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [active]);

  if (!visible || drips.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Top cheese coating bar */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: '8px',
          background: 'linear-gradient(to bottom, hsl(42, 90%, 48%), hsl(42, 90%, 50% / 0.6))',
          borderRadius: '0 0 4px 4px',
          animation: 'cheese-coat-in 0.4s ease-out forwards',
        }}
      />

      {drips.map((drip) => (
        <div
          key={drip.id}
          className="absolute top-0"
          style={{
            left: `${drip.left}%`,
            width: `${drip.width}px`,
            transformOrigin: 'top center',
            animation: `cheese-sway ${drip.swayDuration}s ease-in-out ${drip.delay}s infinite alternate`,
            ['--sway' as string]: `${drip.swayAmount}px`,
          }}
        >
          {/* Anchor bump at top */}
          <div
            style={{
              width: `${drip.width * 1.4}px`,
              height: `${drip.width * 0.5}px`,
              background: 'radial-gradient(ellipse at 50% 0%, hsl(42, 90%, 52%), hsl(40, 85%, 42%))',
              borderRadius: '0 0 50% 50%',
              margin: '0 auto',
            }}
          />

          {/* Stretching strand */}
          <div
            style={{
              width: `${drip.width * 0.4}px`,
              height: `${drip.maxHeight}px`,
              margin: '0 auto',
              marginTop: '-2px',
              transformOrigin: 'top center',
              background: `linear-gradient(to bottom, 
                hsl(42, 90%, 50%), 
                hsl(42, 90%, 50%) 60%, 
                ${drip.detaches ? 'hsl(42, 90%, 50% / 0.2)' : 'hsl(42, 90%, 50% / 0.5)'} 100%)`,
              borderRadius: '0 0 3px 3px',
              animation: `cheese-stretch ${drip.duration}s cubic-bezier(0.25, 0.1, 0.25, 1) ${drip.delay}s forwards`,
            }}
          />

          {/* Bottom blob */}
          <div
            style={{
              width: `${drip.width * 1.1}px`,
              height: `${drip.width * 1.4}px`,
              margin: '-4px auto 0',
              background: `radial-gradient(ellipse at 40% 30%, 
                hsl(48, 100%, 65%), 
                hsl(42, 90%, 50%) 50%, 
                hsl(38, 80%, 38%))`,
              borderRadius: '40% 40% 50% 50%',
              transformOrigin: 'top center',
              animation: `cheese-bulge ${drip.duration}s cubic-bezier(0.25, 0.1, 0.25, 1) ${drip.delay}s forwards${drip.detaches ? `, cheese-detach ${drip.duration * 0.3}s ease-in ${drip.delay + drip.duration * 0.85}s forwards` : ''}`,
            }}
          />
        </div>
      ))}

      <style>{`
        @keyframes cheese-stretch {
          0% { transform: scaleY(0.02); opacity: 0.8; }
          10% { transform: scaleY(0.05); opacity: 1; }
          40% { transform: scaleY(0.3); }
          70% { transform: scaleY(0.7); }
          100% { transform: scaleY(1); opacity: 0.9; }
        }
        @keyframes cheese-bulge {
          0% { transform: scale(0.3); opacity: 0; }
          15% { transform: scale(0.5); opacity: 1; }
          50% { transform: scale(0.8) translateY(0); }
          80% { transform: scale(1.1) translateY(4px); }
          100% { transform: scale(1) translateY(2px); opacity: 0.9; }
        }
        @keyframes cheese-sway {
          0% { transform: translateX(calc(var(--sway) * -1)); }
          100% { transform: translateX(var(--sway)); }
        }
        @keyframes cheese-detach {
          0% { transform: scale(1) translateY(0); opacity: 0.9; }
          100% { transform: scale(0.6) translateY(120px); opacity: 0; }
        }
        @keyframes cheese-coat-in {
          0% { transform: scaleX(0); opacity: 0; }
          100% { transform: scaleX(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
