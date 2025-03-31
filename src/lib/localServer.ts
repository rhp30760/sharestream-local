
import { nanoid } from 'nanoid';

// This file handles local server for file transfers

// Store file data in memory
interface FileData {
  id: string;
  name: string;
  size: number;
  type: string;
  data: ArrayBuffer;
  createdAt: number; // Adding timestamp for sorting
}

// Define a key for localStorage
const STORAGE_KEY = 'localshare_files';
const DB_NAME = 'localshare_db';
const STORE_NAME = 'files';

// In-memory storage for files
let fileStorage = new Map<string, FileData>();

// Initialize IndexedDB
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = (event) => {
      console.error('IndexedDB error:', event);
      reject('Could not open IndexedDB');
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// Load file from IndexedDB
const loadFileFromDB = async (fileId: string): Promise<FileData | null> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(fileId);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = (event) => {
        console.error('Error loading file from IndexedDB:', event);
        reject(null);
      };
    });
  } catch (error) {
    console.error('Failed to load file from IndexedDB:', error);
    return null;
  }
};

// Save file to IndexedDB
const saveFileToDB = async (file: FileData): Promise<boolean> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(file);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('Error saving file to IndexedDB:', event);
        resolve(false);
      };
    });
  } catch (error) {
    console.error('Failed to save file to IndexedDB:', error);
    return false;
  }
};

// Delete file from IndexedDB
const deleteFileFromDB = async (fileId: string): Promise<boolean> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(fileId);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('Error deleting file from IndexedDB:', event);
        resolve(false);
      };
    });
  } catch (error) {
    console.error('Failed to delete file from IndexedDB:', error);
    return false;
  }
};

// List all files from IndexedDB
const listFilesFromDB = async (): Promise<FileData[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = (event) => {
        console.error('Error listing files from IndexedDB:', event);
        resolve([]);
      };
    });
  } catch (error) {
    console.error('Failed to list files from IndexedDB:', error);
    return [];
  }
};

// Initialize storage from IndexedDB
const initializeFromStorage = async () => {
  try {
    // First load metadata from localStorage for backward compatibility
    const savedFiles = localStorage.getItem(STORAGE_KEY);
    if (savedFiles) {
      const fileObjects = JSON.parse(savedFiles);
      fileObjects.forEach((file: Omit<FileData, 'data'> & { hasData: boolean }) => {
        if (!file.hasData) {
          // Add metadata-only entries (these will show as "unavailable" when accessed from other devices)
          fileStorage.set(file.id, {
            ...file,
            data: new ArrayBuffer(0) // Empty buffer for files without data
          });
        }
      });
    }
    
    // Then load from IndexedDB, which overrides localStorage data if available
    const dbFiles = await listFilesFromDB();
    dbFiles.forEach(file => {
      fileStorage.set(file.id, file);
    });
    
    console.log(`Loaded ${fileStorage.size} files from storage`);
  } catch (error) {
    console.error("Failed to load from storage:", error);
  }
};

// Save file metadata to localStorage and actual file to IndexedDB
const saveToStorage = async () => {
  try {
    // Save metadata to localStorage for quick access
    const serializable = Array.from(fileStorage.values()).map(file => ({
      id: file.id,
      name: file.name,
      size: file.size,
      type: file.type,
      createdAt: file.createdAt,
      hasData: file.data.byteLength > 0 // Flag to indicate if the actual data is available
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    
    // Save actual file data to IndexedDB
    for (const file of fileStorage.values()) {
      if (file.data.byteLength > 0) {
        await saveFileToDB(file);
      }
    }
  } catch (error) {
    console.error("Failed to save to storage:", error);
  }
};

// Initialize on module load
initializeFromStorage();

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
    
    reader.onload = async (event) => {
      if (!event.target?.result) {
        reject(new Error("Failed to read file"));
        return;
      }
      
      const fileId = nanoid();
      const fileData: FileData = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        data: event.target.result as ArrayBuffer,
        createdAt: Date.now()
      };
      
      fileStorage.set(fileId, fileData);
      
      // Save to persistent storage
      await saveToStorage();
      
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
export const deleteFile = async (fileId: string): Promise<boolean> => {
  const result = fileStorage.delete(fileId);
  if (result) {
    await deleteFileFromDB(fileId);
    await saveToStorage(); // Update localStorage
  }
  return result;
};

// Get a blob URL for a file
export const getFileBlobUrl = (fileId: string): string | null => {
  const file = fileStorage.get(fileId);
  if (!file) return null;
  
  // Check if this is a placeholder file (no data)
  if (file.data.byteLength === 0) {
    return null;
  }
  
  const blob = new Blob([file.data], { type: file.type || 'application/octet-stream' });
  return URL.createObjectURL(blob);
};
