import { useParams } from 'react-router-dom';

export default function CharacterDetail() {
  const { id, charId } = useParams<{ id: string; charId: string }>();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-100">Character</h1>
      <p className="mt-2 text-gray-400 text-sm">Campaign {id} · Character {charId}</p>
    </div>
  );
}
