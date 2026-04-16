import { useParams } from 'react-router-dom';

export default function FactionDetail() {
  const { id, factionId } = useParams<{ id: string; factionId: string }>();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-100">Faction</h1>
      <p className="mt-2 text-gray-400 text-sm">Campaign {id} · Faction {factionId}</p>
    </div>
  );
}
