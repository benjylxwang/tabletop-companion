import { useParams } from 'react-router-dom';

export default function SessionDetail() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-100">Session</h1>
      <p className="mt-2 text-gray-400 text-sm">Campaign {id} · Session {sessionId}</p>
    </div>
  );
}
