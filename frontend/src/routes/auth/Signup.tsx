import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import AuthShell, { AuthError, AuthField, AuthSubmit } from './AuthShell';

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    const { error: signUpError } = await signUp({
      email,
      password,
      displayName: displayName.trim() || undefined,
    });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    navigate('/check-email', { replace: true, state: { email } });
  }

  return (
    <AuthShell title="Create account" subtitle="Start chronicling your adventures.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="displayName"
          label="Display name"
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
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
          autoComplete="new-password"
          required
          minLength={6}
          hint="At least 6 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <AuthError message={error} />}

        <AuthSubmit submitting={submitting} idleLabel="Create account" busyLabel="Creating account…" />
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-amber-400 hover:text-amber-300">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
