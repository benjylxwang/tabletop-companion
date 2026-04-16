import { Link, useLocation } from 'react-router-dom';
import AuthShell from './AuthShell';

interface LocationState {
  email?: string;
}

export default function CheckEmail() {
  const location = useLocation();
  const email = (location.state as LocationState | null)?.email;

  return (
    <AuthShell title="Check your email" subtitle="We need to confirm it's you.">
      <p className="text-sm text-slate-300">
        We sent a confirmation link
        {email ? (
          <>
            {' '}to <span className="font-medium text-amber-300">{email}</span>
          </>
        ) : (
          <> to the address you signed up with</>
        )}
        . Click the link to activate your account, then return here to log in.
      </p>

      <p className="mt-4 text-xs text-slate-400">
        Can't find it? Check spam, or{' '}
        <Link to="/signup" className="text-amber-400 hover:text-amber-300">
          try again
        </Link>
        .
      </p>

      <div className="mt-6">
        <Link
          to="/login"
          className="block w-full rounded-md border border-slate-700 py-2 text-center text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          Back to log in
        </Link>
      </div>
    </AuthShell>
  );
}
