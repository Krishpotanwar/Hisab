import { motion } from 'framer-motion';
import { Wallet } from 'lucide-react';
import { useState } from 'react';

const currencySquares = [
  { symbol: '₹', radius: 120, duration: 8,  startAngle: 0,   size: 44, delay: 0.2 },
  { symbol: '$', radius: 150, duration: 10,  startAngle: 60,  size: 40, delay: 0.4 },
  { symbol: '€', radius: 130, duration: 12,  startAngle: 120, size: 42, delay: 0.6 },
  { symbol: '£', radius: 160, duration: 9,   startAngle: 180, size: 38, delay: 0.8 },
  { symbol: '¥', radius: 140, duration: 11,  startAngle: 240, size: 40, delay: 1.0 },
  { symbol: '₿', radius: 170, duration: 7,   startAngle: 300, size: 36, delay: 1.2 },
];

function CurrencySquare({
  symbol,
  radius,
  duration,
  startAngle,
  size,
  delay,
}: typeof currencySquares[number]) {
  const [isHovered, setIsHovered] = useState(false);

  // Convert start angle to radians for initial position
  const startRad = (startAngle * Math.PI) / 180;
  const initialX = Math.cos(startRad) * radius;
  const initialY = Math.sin(startRad) * radius;

  return (
    <motion.div
      className="absolute"
      style={{
        left: '50%',
        top: '50%',
        marginLeft: -size / 2,
        marginTop: -size / 2,
      }}
      initial={{ opacity: 0, scale: 0, x: initialX, y: initialY }}
      animate={{
        opacity: 1,
        scale: 1,
        x: [
          Math.cos(startRad) * radius,
          Math.cos(startRad + Math.PI / 3) * radius,
          Math.cos(startRad + (2 * Math.PI) / 3) * radius,
          Math.cos(startRad + Math.PI) * radius,
          Math.cos(startRad + (4 * Math.PI) / 3) * radius,
          Math.cos(startRad + (5 * Math.PI) / 3) * radius,
          Math.cos(startRad + 2 * Math.PI) * radius,
        ],
        y: [
          Math.sin(startRad) * radius,
          Math.sin(startRad + Math.PI / 3) * radius,
          Math.sin(startRad + (2 * Math.PI) / 3) * radius,
          Math.sin(startRad + Math.PI) * radius,
          Math.sin(startRad + (4 * Math.PI) / 3) * radius,
          Math.sin(startRad + (5 * Math.PI) / 3) * radius,
          Math.sin(startRad + 2 * Math.PI) * radius,
        ],
      }}
      transition={{
        opacity: { delay, duration: 0.5 },
        scale: { delay, duration: 0.5, type: 'spring', stiffness: 200, damping: 15 },
        x: { delay: delay + 0.5, duration, repeat: Infinity, ease: 'linear' },
        y: { delay: delay + 0.5, duration, repeat: Infinity, ease: 'linear' },
      }}
    >
      <motion.div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{
          rotateY: isHovered ? 180 : [0, 360],
          rotateX: isHovered ? 15 : 0,
          scale: isHovered ? 1.3 : 1,
        }}
        transition={
          isHovered
            ? { duration: 0.4, ease: 'easeOut' }
            : { rotateY: { duration: duration * 0.8, repeat: Infinity, ease: 'linear' }, scale: { duration: 0.3 } }
        }
        className="cursor-pointer select-none"
        style={{
          width: size,
          height: size,
          perspective: 600,
        }}
      >
        <div
          className="w-full h-full rounded-xl flex items-center justify-center border border-white/20 shadow-lg"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: isHovered
              ? '0 8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.3)'
              : '0 4px 16px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
            transition: 'box-shadow 0.3s ease',
          }}
        >
          <span
            className="font-bold text-primary/70"
            style={{ fontSize: size * 0.45 }}
          >
            {symbol}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5 flex items-center justify-center z-50">
      <div className="text-center relative">
        {/* Floating currency squares orbiting around the center */}
        <div className="absolute inset-0 pointer-events-auto" aria-hidden="true">
          {currencySquares.map((sq) => (
            <CurrencySquare key={sq.symbol} {...sq} />
          ))}
        </div>

        {/* Main wallet icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            duration: 0.8
          }}
          className="relative z-10 inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-primary shadow-float mb-8"
        >
          <Wallet className="w-12 h-12 text-primary-foreground" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="relative z-10 text-4xl font-bold text-foreground mb-2"
        >
          HisaabKitaab
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="relative z-10 text-muted-foreground text-lg"
        >
          Split expenses, stay friends
        </motion.p>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="relative z-10 mt-8 mx-auto w-32 h-1 bg-primary/30 rounded-full overflow-hidden origin-left will-change-transform"
        >
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: "linear"
            }}
            className="w-full h-full bg-primary will-change-transform"
          />
        </motion.div>
      </div>
    </div>
  );
}
