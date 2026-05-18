import type { BridgeHealth, BrowserGpsControl, MeshControl, PhoneGpsControl, RadioControl } from '../sidebarTypes';
import type { ActiveView } from '../../types/view';
import { ConfigSidebarPanel } from './ConfigSidebarPanel';
import { NavigationPanel } from './NavigationPanel';
import { NetworkSidebarPanel } from './NetworkSidebarPanel';
import { NodeStatusPanel } from './NodeStatusPanel';

export function Sidebar({
  open,
  activeView,
  radio,
  mesh,
  browserGps,
  phoneGps,
  bridgeHealth,
  onViewChange,
}: {
  open: boolean;
  activeView: ActiveView;
  radio: RadioControl;
  mesh: MeshControl;
  browserGps: BrowserGpsControl;
  phoneGps: PhoneGpsControl;
  bridgeHealth: BridgeHealth;
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
      {activeView === 'network' && (
        <NetworkSidebarPanel radio={radio} mesh={mesh} browserGps={browserGps} phoneGps={phoneGps} bridgeHealth={bridgeHealth} />
      )}
      {activeView === 'config' && <ConfigSidebarPanel />}
      <NodeStatusPanel />
    </div>
  );
}
