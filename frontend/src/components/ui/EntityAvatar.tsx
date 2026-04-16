import {
  BookMarked,
  BookOpen,
  Ghost,
  MapPin,
  ScrollText,
  Shield,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useSignedUrl } from '../../lib/useSignedUrl';

type EntityType = 'campaign' | 'session' | 'character' | 'npc' | 'location' | 'faction' | 'lore';

const ENTITY_ICONS: Record<EntityType, LucideIcon> = {
  campaign: BookOpen,
  session: ScrollText,
  character: User,
  npc: Ghost,
  location: MapPin,
  faction: Shield,
  lore: BookMarked,
};

interface EntityAvatarProps {
  imageUrl?: string | null;
  entityType: EntityType;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<EntityAvatarProps['size']>, string> = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
};

const ICON_SIZES: Record<NonNullable<EntityAvatarProps['size']>, number> = {
  sm: 16,
  md: 20,
};

export function EntityAvatar({ imageUrl, entityType, size = 'sm', className = '' }: EntityAvatarProps) {
  const { url, isLoading } = useSignedUrl(imageUrl);
  const Icon = ENTITY_ICONS[entityType];
  const sizeClass = SIZE_CLASSES[size];
  const iconSize = ICON_SIZES[size];

  const base = `${sizeClass} shrink-0 rounded-md bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center ${className}`;

  if (imageUrl && isLoading) {
    return <div className={`${base} animate-pulse`} />;
  }

  if (url) {
    return (
      <div className={base}>
        <img src={url} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={base}>
      <Icon size={iconSize} className="text-slate-500" />
    </div>
  );
}
