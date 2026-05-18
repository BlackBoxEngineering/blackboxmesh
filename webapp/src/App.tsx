import { useEffect, useState } from 'react';
import { RadioView } from './components/RadioView';
import { useBridgeHealth } from './hooks/useBridgeHealth';
import { useGpsBridge } from './hooks/useGpsBridge';
import { useMeshConnection } from './hooks/useMeshConnection';
import { usePersistentToggle } from './hooks/usePersistentToggle';
import { useRadioConnection } from './hooks/useRadioConnection';
import { useRadioGpsFeed } from './hooks/useRadioGpsFeed';
import { BottomTerminal } from './layout/BottomTerminal';
import { Header } from './layout/Header';
import { MobileOverlay } from './layout/MobileOverlay';
import { Sidebar } from './layout/Sidebar';
import type { ActiveView } from './types/view';
import { ConfigView } from './views/ConfigView';
import { MapView } from './views/MapView';
import { NetworkView } from './views/NetworkView';

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>(() => (localStorage.getItem('activeView') as ActiveView | null) || 'network');
  const [gpsBridgeRunning, , handleGpsBridgeToggle] = usePersistentToggle('gpsBridgeRunning');
  const [browserGeoEnabled, , handleBrowserGeoToggle] = usePersistentToggle('browserGeoEnabled');
  const [floodAnnouncerRunning, setFloodAnnouncerRunning] = useState(false);
  const bridgeHealth = useBridgeHealth();
  const { radioStatus, radioNodeId, radioSupported, handleRadioToggle } = useRadioConnection();
  const { status: meshStatus, nodes: meshNodes, supported: meshSupported, handleMeshToggle } = useMeshConnection();

  useEffect(() => {
    localStorage.setItem('activeView', activeView);
  }, [activeView]);

  useGpsBridge(gpsBridgeRunning);
  useRadioGpsFeed(radioStatus, browserGeoEnabled);

  const radio = {
    status: radioStatus,
    nodeId: radioNodeId,
    supported: radioSupported,
    onToggle: handleRadioToggle,
  };
  const mesh = {
    status: meshStatus,
    nodeCount: meshNodes.length,
    supported: meshSupported,
    onToggle: handleMeshToggle,
  };
  const browserGps = {
    enabled: browserGeoEnabled,
    onToggle: handleBrowserGeoToggle,
  };
  const phoneGps = {
    enabled: gpsBridgeRunning,
    onToggle: handleGpsBridgeToggle,
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      <Header sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          activeView={activeView}
          radio={radio}
          mesh={mesh}
          browserGps={browserGps}
          phoneGps={phoneGps}
          bridgeHealth={bridgeHealth}
          onViewChange={setActiveView}
        />
        <MobileOverlay open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-gray-900 p-4">
            <div className="h-full bg-gray-800 rounded-lg p-4">
              {activeView === 'network' && (
                <NetworkView
                  bridgeHealth={bridgeHealth}
                  browserGps={browserGps}
                  phoneGps={phoneGps}
                  floodAnnouncerRunning={floodAnnouncerRunning}
                  onFloodAnnouncerToggle={() => setFloodAnnouncerRunning(!floodAnnouncerRunning)}
                />
              )}
              {activeView === 'config' && <ConfigView />}
              {activeView === 'map' && <MapView browserGeoEnabled={browserGeoEnabled} />}
              {activeView === 'radio' && <RadioView />}
            </div>
          </div>
          <BottomTerminal />
        </div>
      </div>
    </div>
  );
}
