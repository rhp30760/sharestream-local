
// This file handles WebRTC peer connections using PeerJS

export const initializePeerConnection = async () => {
  // Dynamically import PeerJS to avoid issues with SSR
  const { default: Peer } = await import('peerjs');
  
  return new Promise<{ peer: any, id: string }>((resolve, reject) => {
    // Generate a random ID for this peer
    const randomId = Math.random().toString(36).substring(2, 15);
    
    // Create a new Peer instance with the random ID
    const peer = new Peer(randomId, {
      debug: 2, // Log level (0-3)
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          { urls: 'turn:numb.viagenie.ca', username: 'webrtc@live.com', credential: 'muazkh' }
        ]
      },
      // Add retry options
      reconnectTimer: 1000,
      retryCount: 5
    });

    // Handle successful connection to the signaling server
    peer.on('open', (id) => {
      console.log("Peer connection established with ID:", id);
      resolve({ peer, id });
    });

    // Handle errors
    peer.on('error', (error) => {
      console.error('Peer connection error:', error);
      reject(error);
    });
  });
};
