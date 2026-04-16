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
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

const POPOVER_SIZE = 256;
const POPOVER_GAP = 8;

interface PopoverPosition {
  top: number;
  left: number;
}

function ImagePopover({ url, top, left }: { url: string; top: number; left: number }) {
  return createPortal(
    <div
      className="fixed z-[9999] rounded-lg border border-amber-500/40 bg-slate-900 shadow-2xl overflow-hidden pointer-events-none"
      style={{ top, left, width: POPOVER_SIZE }}
    >
      <img
        src={url}
        alt=""
        className="w-full object-contain max-h-80"
        style={{ display: 'block' }}
      />
    </div>,
    document.body,
  );
}

export function EntityAvatar({ imageUrl, entityType, size = 'sm', className = '' }: EntityAvatarProps) {
  const { url, isLoading } = useSignedUrl(imageUrl);
  const Icon = ENTITY_ICONS[entityType];
  const sizeClass = SIZE_CLASSES[size];
  const iconSize = ICON_SIZES[size];
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<PopoverPosition | null>(null);

  const base = `${sizeClass} shrink-0 rounded-md bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center ${className}`;

  function handleMouseEnter() {
    if (!url || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.right;
    const left =
      spaceRight >= POPOVER_SIZE + POPOVER_GAP
        ? rect.right + POPOVER_GAP
        : rect.left - POPOVER_SIZE - POPOVER_GAP;
    const top = Math.min(rect.top, window.innerHeight - POPOVER_SIZE - POPOVER_GAP);
    setPopoverPos({ top, left });
  }

  function handleMouseLeave() {
    setPopoverPos(null);
  }

  if (imageUrl && isLoading) {
    return <div className={`${base} animate-pulse`} />;
  }

  if (url) {
    return (
      <>
        <div
          ref={wrapperRef}
          className={base}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <img src={url} alt="" className="w-full h-full object-cover" />
        </div>
        {popoverPos && <ImagePopover url={url} top={popoverPos.top} left={popoverPos.left} />}
      </>
    );
  }

  return (
    <div className={base}>
      <Icon size={iconSize} className="text-slate-500" />
    </div>
  );
}
