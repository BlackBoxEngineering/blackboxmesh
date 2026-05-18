import type { BridgeHealth, BrowserGpsControl, MeshControl, PhoneGpsControl, RadioControl } from '../sidebarTypes';
import { ConnectionsPanel } from './ConnectionsPanel';
import { LocalHubPanel } from './LocalHubPanel';

export function NetworkSidebarPanel({
  radio,
  mesh,
  browserGps,
  phoneGps,
  bridgeHealth,
}: {
  radio: RadioControl;
  mesh: MeshControl;
  browserGps: BrowserGpsControl;
  phoneGps: PhoneGpsControl;
  bridgeHealth: BridgeHealth;
}) {
  return (
    <div className="p-4 border-b border-gray-700">
      <div className="space-y-3">
        <ConnectionsPanel radio={radio} mesh={mesh} browserGps={browserGps} phoneGps={phoneGps} bridgeHealth={bridgeHealth} />
        <LocalHubPanel bridgeHealth={bridgeHealth} />
      </div>
    </div>
  );
}
