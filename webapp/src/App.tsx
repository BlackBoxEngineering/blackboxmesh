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
import { terminalLogStore } from './services/terminalLogStore';
import { radioTransportManager } from './services/transport/radioTransportManager';
import type { ActiveView } from './types/view';
import { MapView } from './views/MapView';
import { MessagesView } from './views/MessagesView';
import { NetworkView } from './views/NetworkView';
import { SettingsView } from './views/SettingsView';

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    const stored = localStorage.getItem('activeView');
    if (stored === 'config' || stored === 'settings') return 'settings';
    if (stored === 'network' || stored === 'map' || stored === 'messages' || stored === 'radio') return stored;
    return 'network';
  });
  const [gpsBridgeRunning, , handleGpsBridgeToggle] = usePersistentToggle('gpsBridgeRunning');
  const [browserGeoEnabled, , handleBrowserGeoToggle] = usePersistentToggle('browserGeoEnabled');
  const [floodAnnouncerRunning, setFloodAnnouncerRunning] = useState(false);
  const bridgeHealth = useBridgeHealth();
  const {
    radioStatus,
    radioNodeId,
    activeTransport,
    radioUsbSupported,
    radioBleSupported,
    connectUsb,
    connectBle,
    disconnectRadio,
  } = useRadioConnection();
  const { status: meshStatus, nodes: meshNodes, supported: meshSupported, handleMeshToggle } = useMeshConnection();

  useEffect(() => {
    localStorage.setItem('activeView', activeView);
  }, [activeView]);

  useEffect(() => {
    const off = radioTransportManager.onEvent((e) => {
      terminalLogStore.addIn(e.raw);
    });
    return () => off();
  }, []);

  useGpsBridge(gpsBridgeRunning);
  useRadioGpsFeed(radioStatus, browserGeoEnabled);

  const radio = {
    status: radioStatus,
    nodeId: radioNodeId,
    usbSupported: radioUsbSupported,
    bleSupported: radioBleSupported,
    activeTransport,
    onConnectUsb: connectUsb,
    onConnectBle: connectBle,
    onDisconnect: disconnectRadio,
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
          onViewChange={setActiveView}
        />
        <MobileOverlay open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 bg-gray-900 p-4 min-h-0">
            <div className="h-full bg-gray-800 rounded-lg p-4 overflow-y-auto">
              {activeView === 'network' && (
                <NetworkView
                  bridgeHealth={bridgeHealth}
                  browserGps={browserGps}
                  phoneGps={phoneGps}
                  floodAnnouncerRunning={floodAnnouncerRunning}
                  onFloodAnnouncerToggle={() => setFloodAnnouncerRunning(!floodAnnouncerRunning)}
                />
              )}
              {activeView === 'settings' && (
                <SettingsView
                  radio={radio}
                  mesh={mesh}
                  browserGps={browserGps}
                  phoneGps={phoneGps}
                  bridgeHealth={bridgeHealth}
                />
              )}
              {activeView === 'map' && <MapView browserGeoEnabled={browserGeoEnabled} />}
              {activeView === 'messages' && <MessagesView />}
              {activeView === 'radio' && <RadioView />}
            </div>
          </div>
          <BottomTerminal />
        </div>
      </div>
    </div>
  );
}
