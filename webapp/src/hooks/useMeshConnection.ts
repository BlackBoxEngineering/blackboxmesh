import { useEffect, useState } from 'react';
import { meshClient, type MeshStatus } from '../services/meshClient';
import type { BlackBoxMeshNode } from '../services/types';

export function useMeshConnection() {
  const [status, setStatus] = useState<MeshStatus>(() => meshClient.getStatus());
  const [nodes, setNodes] = useState<BlackBoxMeshNode[]>(() => meshClient.getNodes());

  useEffect(() => {
    const offStatus = meshClient.onStatus(setStatus);
    const offNodes = meshClient.onNodes(setNodes);
    void meshClient.tryAutoReconnect();
    return () => {
      offStatus();
      offNodes();
    };
  }, []);

  const handleMeshToggle = async () => {
    if (status === 'connected' || status === 'connecting') {
      meshClient.disconnect();
      return;
    }
    try {
      await meshClient.connect();
    } catch (error) {
      console.warn('[mesh] connect failed', error);
    }
  };

  return { status, nodes, supported: true as const, handleMeshToggle };
}
