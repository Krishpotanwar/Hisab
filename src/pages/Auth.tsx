import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Mail, Lock, User, Phone, ArrowRight, Loader2, Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { CurrencyHoverGrid } from '@/components/CurrencyHoverGrid';

type AuthMode = 'login' | 'signup' | 'forgot-email' | 'forgot-verify';

function friendlyAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('rate') || m.includes('too many') || m.includes('after') || m.includes('seconds'))
    return 'Too many attempts. Please wait a minute and try again.';
  if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('email not confirmed'))
    return 'Incorrect email or password.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'An account with this email already exists. Try signing in.';
  if (m.includes('password') && m.includes('weak'))
    return 'Password is too weak. Use at least 8 characters.';
  if (m.includes('email') && (m.includes('invalid') || m.includes('format')))
    return 'Please enter a valid email address.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Network error. Check your connection and try again.';
  if (m.includes('token') && (m.includes('expired') || m.includes('invalid')))
    return 'The code has expired or is incorrect. Please request a new one.';
  if (m.includes('otp') || m.includes('type not supported'))
    return 'Unable to verify code. Please try again.';
  return msg;
}

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, sendPasswordResetOtp, verifyOtpAndUpdatePassword, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const raw = searchParams.get('redirect') || '/';
  const redirectPath = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

  useEffect(() => {
    if (user) navigate(redirectPath, { replace: true });
  }, [user, navigate, redirectPath]);

  const switchMode = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    setPassword('');
    setConfirmPassword('');
  };

  const goBackToLogin = () => {
    setMode('login');
    setOtpCode('');
    setPassword('');
    setConfirmPassword('');
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      if (password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
      if (!fullName.trim()) {
        toast.error('Please enter your full name');
        return;
      }
    }

    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(friendlyAuthError(error.message));
        setLoading(false);
      } else {
        navigate(redirectPath, { replace: true });
      }
    } else if (mode === 'signup') {
      const { error } = await signUp(email, password, fullName.trim(), phone.trim() || undefined);
      if (error) {
        toast.error(friendlyAuthError(error.message));
        setLoading(false);
      } else {
        toast.success('Account created! Welcome to HisaabKitaab');
        try {
          const { data: pending } = await supabase
            .from('pending_members')
            .select('group_id')
            .eq('invited_email', email.trim().toLowerCase());
          const pendingCount = pending?.length ?? 0;
          if (pendingCount > 0) {
            setTimeout(() => {
              toast.info(`You've been added to ${pendingCount} group${pendingCount > 1 ? 's' : ''} already!`);
            }, 1000);
          }
        } catch {
          // pending_members table may not be set up yet — ignore
        }
        navigate(redirectPath, { replace: true });
      }
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await sendPasswordResetOtp(email);
    setLoading(false);
    if (error) {
      toast.error(friendlyAuthError(error.message));
    } else {
      toast.success('Code sent! Check your email.');
      setOtpCode('');
      setPassword('');
      setConfirmPassword('');
      setMode('forgot-verify');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    const { error } = await verifyOtpAndUpdatePassword(email, otpCode, password);
    setLoading(false);
    if (error) {
      toast.error(friendlyAuthError(error.message));
    } else {
      toast.success('Password reset! You are now signed in.');
      navigate(redirectPath, { replace: true });
    }
  };

  return (
    <div className="relative min-h-[100dvh] bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <CurrencyHoverGrid />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
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
          {/* Forgot password views */}
          <AnimatePresence mode="wait">
            {(mode === 'forgot-email' || mode === 'forgot-verify') && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  type="button"
                  onClick={goBackToLogin}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </button>

                <div className="flex items-center gap-2 mb-4">
                  <KeyRound className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">
                    {mode === 'forgot-email' ? 'Reset Password' : 'Enter Code'}
                  </h2>
                </div>

                {mode === 'forgot-email' ? (
                  <form onSubmit={handleSendOtp} className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Enter your email and we'll send a verification code.
                    </p>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        autoComplete="email"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                      {loading ? 'Sending…' : 'Send Code'}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>.
                    </p>
                    <Input
                      type="text"
                      placeholder="6-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="tracking-widest text-center text-lg font-mono"
                      required
                      maxLength={6}
                      autoComplete="one-time-code"
                      inputMode="numeric"
                    />
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="New password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                        minLength={8}
                        autoComplete="new-password"
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
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm new password"
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
                      <p className="text-xs text-destructive pl-1">Passwords do not match</p>
                    )}
                    <Button type="submit" className="w-full" disabled={loading || otpCode.length < 6}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                      {loading ? 'Verifying…' : 'Reset Password'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setMode('forgot-email'); setOtpCode(''); }}
                      className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
                    >
                      Didn't receive a code? Send again
                    </button>
                  </form>
                )}
              </motion.div>
            )}

            {/* Login / Signup views */}
            {(mode === 'login' || mode === 'signup') && (
              <motion.div
                key="auth"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Tab switcher */}
                <div className="flex mb-6 bg-muted rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                      mode === 'login' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                      mode === 'signup' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    Sign Up
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <AnimatePresence initial={false}>
                    {mode === 'signup' && (
                      <motion.div
                        key="signup-fields"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 overflow-hidden"
                      >
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
                      autoComplete="email"
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
                      minLength={mode === 'login' ? 1 : 8}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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

                  {/* Forgot password link — login mode only */}
                  {mode === 'login' && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => setMode('forgot-email')}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {/* Confirm Password — signup only */}
                  <AnimatePresence initial={false}>
                    {mode === 'signup' && (
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
                    {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
