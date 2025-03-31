
import { nanoid } from 'nanoid';

// This file handles local server for file transfers

// Store file data in memory
interface FileData {
  id: string;
  name: string;
  size: number;
  type: string;
  data: ArrayBuffer;
}

// In-memory storage for files (in a real app, consider IndexedDB for larger files)
const fileStorage = new Map<string, FileData>();

// Get the local network IP address
export const getLocalIpAddress = async (): Promise<string> => {
  try {
    // Try to use WebRTC to get local IP
    const pc = new RTCPeerConnection({ 
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] 
    });
    
    pc.createDataChannel('');
    
    return new Promise<string>((resolve) => {
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        
        // Extract IP from candidate string
        const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
        const ipMatch = ipRegex.exec(e.candidate.candidate);
        
        if (ipMatch && ipMatch[1]) {
          const ip = ipMatch[1];
          if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
            pc.close();
            resolve(ip);
          }
        }
      };
      
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(() => {
          // Fallback to window.location.hostname if WebRTC fails
          resolve(window.location.hostname);
        });
      
      // Timeout after 5 seconds and use hostname as fallback
      setTimeout(() => {
        resolve(window.location.hostname);
      }, 5000);
    });
  } catch (error) {
    console.error("Error getting local IP:", error);
    return window.location.hostname;
  }
};

// Store a file and return a unique ID
export const storeFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (!event.target?.result) {
        reject(new Error("Failed to read file"));
        return;
      }
      
      const fileId = nanoid();
      fileStorage.set(fileId, {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        data: event.target.result as ArrayBuffer
      });
      
      resolve(fileId);
    };
    
    reader.onerror = () => reject(new Error("Error reading file"));
    reader.readAsArrayBuffer(file);
  });
};

// Get file metadata by ID
export const getFileMetadata = (fileId: string): Pick<FileData, 'id' | 'name' | 'size' | 'type'> | null => {
  const file = fileStorage.get(fileId);
  if (!file) return null;
  
  const { id, name, size, type } = file;
  return { id, name, size, type };
};

// Get file data by ID
export const getFileData = (fileId: string): FileData | null => {
  return fileStorage.get(fileId) || null;
};

// List all available files
export const listFiles = (): Array<Pick<FileData, 'id' | 'name' | 'size' | 'type'>> => {
  return Array.from(fileStorage.values()).map(({ id, name, size, type }) => ({
    id, name, size, type
  }));
};

// Delete a file by ID
export const deleteFile = (fileId: string): boolean => {
  return fileStorage.delete(fileId);
};

// Get a blob URL for a file
export const getFileBlobUrl = (fileId: string): string | null => {
  const file = fileStorage.get(fileId);
  if (!file) return null;
  
  const blob = new Blob([file.data], { type: file.type || 'application/octet-stream' });
  return URL.createObjectURL(blob);
};
