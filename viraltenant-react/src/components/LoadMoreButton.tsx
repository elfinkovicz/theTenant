import { ChevronDown } from 'lucide-react';

interface LoadMoreButtonProps {
  onClick: () => void;
  remainingCount: number;
  label?: string;
}

export function LoadMoreButton({ onClick, remainingCount, label = 'Mehr laden' }: LoadMoreButtonProps) {
  return (
    <div className="flex justify-center mt-8">
      <button
        onClick={onClick}
        className="btn-secondary flex items-center gap-2 px-8 py-3"
      >
        <ChevronDown className="w-5 h-5" />
        {label} ({remainingCount} weitere)
      </button>
    </div>
  );
}
