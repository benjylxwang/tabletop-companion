import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../lib/api';

export function Home() {
  const { data, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  });

  const status = isError ? 'error' : (data?.status ?? 'loading');

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Tabletop Companion</h1>
      <p className="mt-4">API status: {status}</p>
    </main>
  );
}
