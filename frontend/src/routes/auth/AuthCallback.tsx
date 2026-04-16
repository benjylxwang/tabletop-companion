import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import AuthShell from './AuthShell';

// Target of `emailRedirectTo` on signup. supabase-js parses the URL hash
// automatically (detectSessionInUrl: true), so we just wait for the auth
// state to settle and then route the user forward.
export default function AuthCallback() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (session) {
      navigate('/', { replace: true });
    } else {
      navigate('/login?confirmed=1', { replace: true });
    }
  }, [loading, session, navigate]);

  return (
    <AuthShell title="Confirming…" subtitle="One moment.">
      <p className="text-sm text-slate-400">Finalising your sign-in.</p>
    </AuthShell>
  );
}
