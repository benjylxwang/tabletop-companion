import { useParams } from 'react-router-dom';

export default function SessionList() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-100">Sessions</h1>
      <p className="mt-2 text-gray-400 text-sm">Campaign {id}</p>
    </div>
  );
}
