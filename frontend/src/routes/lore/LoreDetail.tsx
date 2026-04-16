import { useParams } from 'react-router-dom';

export default function LoreDetail() {
  const { id, loreId } = useParams<{ id: string; loreId: string }>();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-100">Lore Entry</h1>
      <p className="mt-2 text-gray-400 text-sm">Campaign {id} · Entry {loreId}</p>
    </div>
  );
}
