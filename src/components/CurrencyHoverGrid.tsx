import { useRef, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SYMBOLS = ['₹', '$', '€', '£', '¥', '₿', '₩', '฿', '₽', '₴', '₦', '₱'];
const CELL = 60;

interface ActiveCell {
  uid: number;
  sym: string;
  col: number;
  row: number;
  fontSize: string;
  hue: number;
}

let uidCounter = 0;

export function CurrencyHoverGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cells, setCells] = useState<Map<number, ActiveCell>>(new Map());
  const busySet = useRef<Set<number>>(new Set());
  const colsRef = useRef(1);

  useEffect(() => {
    const updateCols = () => {
      if (containerRef.current) {
        colsRef.current = Math.ceil(containerRef.current.clientWidth / CELL);
      }
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / CELL);
    const row = Math.floor((e.clientY - rect.top) / CELL);
    const idx = row * colsRef.current + col;

    if (busySet.current.has(idx)) return;
    busySet.current.add(idx);

    const uid = uidCounter++;
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const sizes = ['1rem', '1.2rem', '1.5rem', '1.8rem'];
    const fontSize = sizes[Math.floor(Math.random() * sizes.length)];
    // slight hue variation around primary for colour variety
    const hue = Math.floor(Math.random() * 60) - 30;

    setCells(prev => new Map(prev).set(idx, { uid, sym, col, row, fontSize, hue }));

    setTimeout(() => {
      setCells(prev => {
        const next = new Map(prev);
        if (next.get(idx)?.uid === uid) next.delete(idx);
        return next;
      });
      busySet.current.delete(idx);
    }, 1000);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden cursor-default"
      onMouseMove={handleMouseMove}
    >
      {/* Subtle grid lines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--primary) / 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--primary) / 0.05) 1px, transparent 1px)
          `,
          backgroundSize: `${CELL}px ${CELL}px`,
        }}
      />

      <AnimatePresence>
        {Array.from(cells.values()).map(cell => (
          <motion.div
            key={cell.uid}
            initial={{ opacity: 0, scale: 0.1, rotate: -15 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.2, rotate: 10, transition: { duration: 0.45, ease: 'easeOut' } }}
            transition={{ duration: 0.18, ease: [0.34, 1.56, 0.64, 1] }}
            className="absolute flex items-center justify-center pointer-events-none select-none rounded-md"
            style={{
              left: cell.col * CELL + 1,
              top: cell.row * CELL + 1,
              width: CELL - 2,
              height: CELL - 2,
              fontSize: cell.fontSize,
              fontWeight: 700,
              background: 'hsl(var(--primary) / 0.08)',
              color: `hsl(calc(var(--primary-h, 220) + ${cell.hue}deg) 70% 55%)`,
              border: '1px solid hsl(var(--primary) / 0.14)',
              boxShadow: '0 0 12px hsl(var(--primary) / 0.15)',
              textShadow: '0 0 8px hsl(var(--primary) / 0.45)',
            }}
          >
            {cell.sym}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
