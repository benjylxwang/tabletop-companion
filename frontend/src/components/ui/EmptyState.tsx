import { Inbox } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      <div className="text-ink-300">
        {icon ?? <Inbox className="h-10 w-10" />}
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-ink-700">{title}</p>
        {description && (
          <p className="text-sm text-ink-500">{description}</p>
        )}
      </div>
      {action && (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
