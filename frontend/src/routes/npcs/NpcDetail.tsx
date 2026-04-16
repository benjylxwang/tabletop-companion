import { useParams } from 'react-router-dom';

export default function NpcDetail() {
  const { id, npcId } = useParams<{ id: string; npcId: string }>();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-100">NPC</h1>
      <p className="mt-2 text-gray-400 text-sm">Campaign {id} · NPC {npcId}</p>
    </div>
  );
}
