import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen flex items-center justify-center bg-slate-950">
            <div className="text-center space-y-4 px-6">
              <h1 className="text-xl font-semibold text-slate-200">Something went wrong</h1>
              <p className="text-sm text-slate-400">{this.state.error?.message}</p>
              <button
                className="text-sm text-indigo-400 hover:text-indigo-300 underline"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
