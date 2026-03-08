import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { SplashScreen } from '@/components/SplashScreen';
import Dashboard from './Dashboard';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Only redirect if auth has fully resolved AND splash is done AND there's definitely no user
    if (!loading && splashDone && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, loading, splashDone, navigate]);

  // Show splash while auth is loading or splash timer is running
  if (loading || !splashDone) {
    return <SplashScreen />;
  }

  // Auth resolved, no user → redirect is pending (avoid flash)
  if (!user) {
    return <SplashScreen />;
  }

  return <Dashboard />;
}
