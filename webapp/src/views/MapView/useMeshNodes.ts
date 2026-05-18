import { useEffect, useState } from 'react';
import { meshClient } from '../../services/meshClient';
import type { BlackBoxMeshNode } from '../../services/types';

export function useMeshNodes() {
  const [liveNodes, setLiveNodes] = useState<BlackBoxMeshNode[]>(() => meshClient.getNodes());

  useEffect(() => meshClient.onNodes(setLiveNodes), []);

  return liveNodes
    .filter((node) => typeof node.latitude === 'number' && typeof node.longitude === 'number')
    .map((node) => ({
      id: node.id,
      latitude: node.latitude as number,
      longitude: node.longitude as number,
      rssi: node.rssi ?? 0,
      snr: node.snr ?? 0,
      accuracy: 10,
    }));
}
