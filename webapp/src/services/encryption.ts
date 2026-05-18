import type { EncryptionResult } from './types';

const ENDECOM_ENDPOINT = 'https://kgu51emdzh.execute-api.us-east-1.amazonaws.com/main/enDeCom';

export const callEnDeCom = async (message: string, password: string): Promise<EncryptionResult> => {
  try {
    const response = await fetch(ENDECOM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_BLACKBOXCOMS as string,
      },
      body: JSON.stringify({ message, password }),
    });

    if (!response.ok) {
      return { status: 'error', message: `EnDeCom service unavailable (${response.status})` };
    }

    const text = await response.text();
    if (!text) return { status: 'error', message: 'Empty response from EnDeCom' };

    const outer = JSON.parse(text);
    if (!outer.body) return { status: 'error', message: 'Invalid response format' };

    const body = JSON.parse(outer.body);
    if (body.status === 'error') return { status: 'error', message: 'Incorrect password or corrupted payload' };

    return { status: body.status, message: body.message };
  } catch (err) {
    return { status: 'error', message: `EnDeCom failed: ${err instanceof Error ? err.message : 'unknown error'}` };
  }
};
