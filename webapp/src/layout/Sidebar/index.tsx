import type { RadioControl } from '../sidebarTypes';
import type { ActiveView } from '../../types/view';
import { NavigationPanel } from './NavigationPanel';

export function Sidebar({
  open,
  activeView,
  radio,
  onViewChange,
}: {
  open: boolean;
  activeView: ActiveView;
  radio: RadioControl;
  onViewChange: (view: ActiveView) => void;
}) {
  return (
    <div className={`bg-gray-800 w-80 flex-shrink-0 transition-transform duration-300 ${
      open ? 'translate-x-0' : '-translate-x-full'
    } md:translate-x-0 absolute md:relative z-20 h-full overflow-y-auto`}>
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">Control Panel</h2>
      </div>
      <NavigationPanel activeView={activeView} radio={radio} onViewChange={onViewChange} />
    </div>
  );
}
