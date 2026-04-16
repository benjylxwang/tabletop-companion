import { useParams } from 'react-router-dom';

export default function LocationDetail() {
  const { id, locationId } = useParams<{ id: string; locationId: string }>();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-100">Location</h1>
      <p className="mt-2 text-gray-400 text-sm">Campaign {id} · Location {locationId}</p>
    </div>
  );
}
