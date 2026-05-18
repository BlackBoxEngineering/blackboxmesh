import express, { Request, Response } from 'express';
import cors from 'cors';
import { exec } from 'child_process';

const app = express();
const PORT = Number(process.env.BLACKBOXMESH_GPS_PORT ?? 8080);
const HOST = process.env.BLACKBOXMESH_GPS_HOST ?? '127.0.0.1';
const CORS_ORIGIN = process.env.BLACKBOXMESH_GPS_CORS_ORIGIN ?? 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173';

app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map((origin) => origin.trim()) }));

interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

let lastPosition: GPSPosition | null = null;

// Get GPS from Android device via ADB
function getAndroidGPS(): Promise<GPSPosition> {
  return new Promise((resolve, reject) => {
    exec('adb shell dumpsys location | findstr "last location"', (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      
      // Parse GPS coordinates from Android Location format
      // Format: Location[gps 53.741747,-2.006214 hAcc=6.4232564 ...]
      const gpsMatch = stdout.match(/Location\[gps\s+([-\d.]+),([-\d.]+)\s+hAcc=([\d.]+)/);
      
      if (gpsMatch) {
        resolve({
          latitude: parseFloat(gpsMatch[1]),
          longitude: parseFloat(gpsMatch[2]),
          accuracy: parseFloat(gpsMatch[3]),
          timestamp: Date.now()
        });
      } else {
        // Try network location as fallback
        const networkMatch = stdout.match(/Location\[network\s+([-\d.]+),([-\d.]+)\s+hAcc=([\d.]+)/);
        if (networkMatch) {
          resolve({
            latitude: parseFloat(networkMatch[1]),
            longitude: parseFloat(networkMatch[2]),
            accuracy: parseFloat(networkMatch[3]),
            timestamp: Date.now()
          });
        } else {
          reject(new Error('Could not parse GPS data'));
        }
      }
    });
  });
}

// GPS endpoint
app.get('/gps', async (req: Request, res: Response) => {
  try {
    const position = await getAndroidGPS();
    lastPosition = position;
    res.json({
      coords: {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy
      },
      timestamp: position.timestamp
    });
  } catch (error) {
    if (lastPosition && (Date.now() - lastPosition.timestamp) < 60000) {
      res.json({
        coords: {
          latitude: lastPosition.latitude,
          longitude: lastPosition.longitude,
          accuracy: lastPosition.accuracy
        },
        timestamp: lastPosition.timestamp
      });
    } else {
      res.status(503).json({ 
        error: 'GPS not available',
        message: 'Make sure phone is connected via USB and ADB is enabled'
      });
    }
  }
});

// Status endpoint
app.get('/status', (req: Request, res: Response) => {
  res.json({ 
    status: 'running',
    lastPosition: lastPosition ? 'available' : 'none'
  });
});

app.listen(PORT, HOST, () => {
  console.log(`GPS Bridge running on:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
    console.log(`  Network: http://${HOST}:${PORT}`);
  }
  console.log('Endpoints:');
  console.log('  GET /gps - Get current GPS position');
  console.log('  GET /status - Bridge status');
  console.log('');
  console.log('Make sure:');
  console.log('  1. Phone is connected via USB');
  console.log('  2. USB debugging is enabled');
  console.log('  3. ADB is installed and in PATH');
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. GPS Bridge may already be running.`);
    process.exit(1);
  } else {
    throw err;
  }
});
