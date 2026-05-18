import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

const app = express();
const PORT = Number(process.env.BLACKBOXMESH_MQTT_PORT ?? 8081);
const HOST = process.env.BLACKBOXMESH_MQTT_HOST ?? '127.0.0.1';
const CORS_ORIGIN = process.env.BLACKBOXMESH_MQTT_CORS_ORIGIN ?? 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173';

app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map((origin) => origin.trim()) }));
app.use(express.json());

interface NodeData {
  nodeId: string;
  lastSeen: number;
  [key: string]: any;
}

// Store connected clients
const clients = new Set<WebSocket>();
const nodes = new Map<string, NodeData>();

interface MeshtasticNode {
  id: string;
  longName?: string;
  shortName?: string;
  hwModel?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  rssi?: number;
  snr?: number;
  lastSeen: number;
}

interface MeshtasticMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  rssi?: number;
  snr?: number;
}

const meshtasticNodes = new Map<string, MeshtasticNode>();
const meshtasticMessages: MeshtasticMessage[] = [];
const MAX_MESSAGES = 200;

// WebSocket server
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);
  console.log('Client connected. Total clients:', clients.size);

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected. Total clients:', clients.size);
  });
});

// Broadcast to all connected clients
function broadcast(data: any): void {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Status endpoint
app.get('/status', (req: Request, res: Response) => {
  res.json({ 
    status: 'running',
    clients: clients.size,
    nodes: nodes.size
  });
});

// Normalize stored telemetry into the shape the webapp expects.
function toClientNode(n: NodeData) {
  return {
    id:        n.nodeId,
    latitude:  typeof n.latitude  === 'number' ? n.latitude  : undefined,
    longitude: typeof n.longitude === 'number' ? n.longitude : undefined,
    rssi:      typeof n.rssi === 'number' ? n.rssi : undefined,
    snr:       typeof n.snr  === 'number' ? n.snr  : undefined,
    routes:    Array.isArray(n.routes) ? n.routes : [],
    routeCount: typeof n.routes === 'number' ? n.routes : undefined,
    messages:  n.messages,
    mode:      n.mode,
    lastSeen:  n.lastSeen,
  };
}

// Report endpoint - receive data from BlackBoxMesh node
app.post('/report', (req: Request, res: Response) => {
  const data = req.body;
  console.log('Node report:', data);

  // Handle Meshtastic observed frames with decoded data
  if (data.type === 'meshtastic_observed' && data.meshtastic) {
    const mt = data.meshtastic;
    const nodeId = mt.from;
    if (nodeId) {
      const prev: MeshtasticNode = meshtasticNodes.get(nodeId) ?? { id: nodeId, lastSeen: 0 };
      const updated: MeshtasticNode = {
        ...prev,
        id: nodeId,
        rssi: data.rssi ?? prev.rssi,
        snr: data.snr ?? prev.snr,
        lastSeen: Date.now(),
      };
      if (mt.nodeInfo) {
        if (mt.nodeInfo.longName) updated.longName = mt.nodeInfo.longName;
        if (mt.nodeInfo.shortName) updated.shortName = mt.nodeInfo.shortName;
        if (mt.nodeInfo.hwModel) updated.hwModel = mt.nodeInfo.hwModel;
      }
      if (mt.position) {
        if (mt.position.latitude != null) updated.latitude = mt.position.latitude;
        if (mt.position.longitude != null) updated.longitude = mt.position.longitude;
        if (mt.position.altitude != null) updated.altitude = mt.position.altitude;
      }
      meshtasticNodes.set(nodeId, updated);
      broadcast({ type: 'meshtastic_node', data: updated });

      // If it's a text message, store and broadcast
      if (mt.portnum === 'TEXT_MESSAGE' && mt.text) {
        const msg: MeshtasticMessage = {
          id: mt.packetId ?? `${Date.now()}`,
          from: nodeId,
          to: mt.to ?? 'broadcast',
          text: mt.text,
          timestamp: Date.now(),
          rssi: data.rssi,
          snr: data.snr,
        };
        meshtasticMessages.push(msg);
        if (meshtasticMessages.length > MAX_MESSAGES) meshtasticMessages.shift();
        broadcast({ type: 'meshtastic_message', data: msg });
      }
    }
    res.json({ success: true });
    return;
  }

  if (data.nodeId) {
    const prev = nodes.get(data.nodeId) ?? { nodeId: data.nodeId, lastSeen: 0 };
    const merged: NodeData = { ...prev, ...data, lastSeen: Date.now() };
    nodes.set(data.nodeId, merged);

    // Broadcast normalized shape so the webapp can consume directly.
    broadcast({ type: 'node_report', data: toClientNode(merged) });
  } else {
    broadcast({ type: 'node_report', data });
  }

  res.json({ success: true });
});

// Send message to mesh
app.post('/send', (req: Request, res: Response) => {
  const { message } = req.body;
  console.log('Sending message to mesh:', message);
  
  // Broadcast to all clients
  broadcast({
    type: 'message',
    data: { message, timestamp: Date.now() }
  });
  
  res.json({ success: true });
});

// Get active nodes
app.get('/nodes', (req: Request, res: Response) => {
  const cutoff = Date.now() - 300000; // 5 minutes
  const activeNodes = Array.from(nodes.values())
    .filter((node) => node.lastSeen >= cutoff)
    .map(toClientNode);
  res.json(activeNodes);
});

// Get Meshtastic nodes (longer TTL since they beacon every 6-15 min)
app.get('/meshtastic/nodes', (req: Request, res: Response) => {
  const cutoff = Date.now() - 1800000; // 30 minutes
  const active = Array.from(meshtasticNodes.values())
    .filter((n) => n.lastSeen >= cutoff);
  res.json(active);
});

// Get Meshtastic messages
app.get('/meshtastic/messages', (req: Request, res: Response) => {
  res.json(meshtasticMessages);
});

// Upgrade HTTP to WebSocket
const server = app.listen(PORT, HOST, () => {
  console.log(`MQTT Bridge running on:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
    console.log(`  Network: http://${HOST}:${PORT}`);
  }
  console.log('Endpoints:');
  console.log('  POST /report - Node telemetry');
  console.log('  POST /send - Send message to mesh');
  console.log('  GET /nodes - Get active nodes');
  console.log('  GET /status - Bridge status');
  console.log('  WS /ws - WebSocket connection');
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. MQTT Bridge may already be running.`);
    process.exit(1);
  } else {
    throw err;
  }
});

server.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
  if (request.url === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      wss.emit('connection', ws, request);
    });
  }
});
