import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Mail, Lock, User, Phone, ArrowRight, Chrome, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signUp, signInWithOAuth, user } = useAuth();
  const navigate = useNavigate();
  const oauthEnabled = import.meta.env.VITE_ENABLE_OAUTH === 'true';

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLogin && password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!isLogin && password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!isLogin && !fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    setLoading(true);
    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) toast.error(error.message);
      else navigate('/', { replace: true });
    } else {
      const { error } = await signUp(email, password, fullName.trim(), phone.trim() || undefined);
      if (error) {
        toast.error(error.message);
      } else {
        // Check if they had pending group invites (DB trigger auto-claimed them)
        const { data: pending } = await supabase
          .from('pending_members')
          .select('group_id')
          .eq('invited_email', email.trim().toLowerCase());
        const pendingCount = pending?.length ?? 0;
        toast.success('Account created! Welcome to HisaabKitaab 🎉');
        if (pendingCount > 0) {
          setTimeout(() => {
            toast.info(`You've been added to ${pendingCount} group${pendingCount > 1 ? 's' : ''} already!`);
          }, 1000);
        }
        navigate('/', { replace: true });
      }
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    if (!oauthEnabled) {
      toast.error('Google login is not configured yet. Use email/password for now.');
      return;
    }
    setGoogleLoading(true);
    const { error } = await signInWithOAuth('google');
    if (error) {
      toast.error(error.message);
      setGoogleLoading(false);
    }
  };

  const switchMode = (login: boolean) => {
    setIsLogin(login);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg mb-4"
          >
            <Wallet className="w-8 h-8 text-primary-foreground" />
          </motion.div>
          <h1 className="text-3xl font-bold">HisaabKitaab</h1>
          <p className="text-muted-foreground mt-1">Split expenses, stay friends</p>
        </div>

        <div className="bg-card rounded-2xl shadow-card p-6 border border-border/50">
          {/* Tab switcher */}
          <div className="flex mb-6 bg-muted rounded-xl p-1">
            <button
              type="button"
              onClick={() => switchMode(true)}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                isLogin ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode(false)}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                !isLogin ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
              )}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <AnimatePresence initial={false}>
              {!isLogin && (
                <motion.div
                  key="signup-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  {/* Full Name */}
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      required
                      autoComplete="name"
                    />
                  </div>
                  {/* Phone */}
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="Phone number (optional)"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10"
                      autoComplete="tel"
                      pattern="[+]?[0-9\s\-]{7,15}"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                autoComplete={isLogin ? 'email' : 'email'}
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
                minLength={isLogin ? 1 : 8}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Confirm Password — signup only */}
            <AnimatePresence initial={false}>
              {!isLogin && (
                <motion.div
                  key="confirm-pw"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={cn(
                        'pl-10 pr-10',
                        confirmPassword && password !== confirmPassword && 'border-destructive focus-visible:ring-destructive'
                      )}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-destructive mt-1 pl-1">Passwords do not match</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" className="w-full mt-1" disabled={loading}>
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <ArrowRight className="w-4 h-4 mr-2" />
              }
              {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/70" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border/70" />
          </div>

          {/* Google */}
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Chrome className="w-4 h-4" />
            }
            Continue with Google
          </Button>

          {!oauthEnabled && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Google login requires configuration — use email & password for now.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
