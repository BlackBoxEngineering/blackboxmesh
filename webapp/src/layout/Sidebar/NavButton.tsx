import type { ActiveView } from '../../types/view';

export function NavButton({
  activeView,
  view,
  label,
  children,
  status,
  onViewChange,
}: {
  activeView: ActiveView;
  view: ActiveView;
  label: string;
  children: React.ReactNode;
  status?: React.ReactNode;
  onViewChange: (view: ActiveView) => void;
}) {
  return (
    <button
      onClick={() => onViewChange(view)}
      className={`w-full text-left p-3 rounded-lg transition-colors ${
        activeView === view ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
      }`}
    >
      <div className="flex items-center gap-2">
        {children}
        <span className="font-medium">{label}</span>
        {status}
      </div>
    </button>
  );
}
