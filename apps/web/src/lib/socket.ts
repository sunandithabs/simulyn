import { io, type Socket } from 'socket.io-client';

import { API_URL, getAccessToken } from './api';

/**
 * Connects to the proctoring namespace. The access token travels in the
 * handshake; the gateway rejects the socket if it does not verify.
 */
export function createProctoringSocket(token?: string): Socket {
  return io(`${API_URL}/proctoring`, {
    transports: ['websocket'],
    auth: { token: token ?? getAccessToken() ?? '' },
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    autoConnect: true,
  });
}

export type { Socket };
