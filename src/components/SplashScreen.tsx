import { motion } from 'framer-motion';
import { Wallet } from 'lucide-react';

export function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5 flex items-center justify-center z-50">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 15,
            duration: 0.8 
          }}
          className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-primary shadow-float mb-8"
        >
          <Wallet className="w-12 h-12 text-primary-foreground" />
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-4xl font-bold text-foreground mb-2"
        >
          HisaabKitaab
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-muted-foreground text-lg"
        >
          Split expenses, stay friends
        </motion.p>
        
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-8 mx-auto w-32 h-1 bg-primary/30 rounded-full overflow-hidden origin-left will-change-transform"
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
