import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import AuthShell, { AuthError, AuthField, AuthSubmit } from './AuthShell';

interface LocationState {
  from?: string;
}

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justConfirmed = new URLSearchParams(location.search).get('confirmed') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    const from = (location.state as LocationState | null)?.from ?? '/';
    navigate(from, { replace: true });
  }

  return (
    <AuthShell title="Log in" subtitle="Welcome back, traveller.">
      {justConfirmed && (
        <p
          role="status"
          className="mb-4 rounded-md border border-emerald-800 bg-emerald-900/30 px-3 py-2 text-xs text-emerald-300"
        >
          Email confirmed. Log in to continue.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <AuthError message={error} />}

        <AuthSubmit submitting={submitting} idleLabel="Sign in" busyLabel="Signing in…" />
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        Don't have an account?{' '}
        <Link to="/signup" className="font-medium text-amber-400 hover:text-amber-300">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
