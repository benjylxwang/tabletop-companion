interface SkeletonProps {
  variant?: 'text' | 'rect' | 'circle';
  className?: string;
}

export function Skeleton({ variant = 'rect', className = '' }: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 w-full rounded',
    rect: 'rounded',
    circle: 'rounded-full',
  };

  return (
    <div
      className={`animate-pulse bg-parchment-200 ${variantClasses[variant]} ${className}`}
    />
  );
}
