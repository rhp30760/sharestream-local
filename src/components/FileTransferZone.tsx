
import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileType, Folder, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { initializePeerConnection } from "@/lib/peerConnection";

interface FileTransferZoneProps {
  onConnectionEstablished: (id: string) => void;
}

const FileTransferZone = ({ onConnectionEstablished }: FileTransferZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [directories, setDirectories] = useState<FileSystemDirectoryEntry[]>([]);
  const [transferProgress, setTransferProgress] = useState<{ [key: string]: number }>({});
  const [transferStatus, setTransferStatus] = useState<"idle" | "connecting" | "transferring" | "completed">("idle");
  const [peerId, setPeerId] = useState<string>("");
  const [peer, setPeer] = useState<any>(null);
  const [connection, setConnection] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const setupPeer = async () => {
      try {
        const { peer, id } = await initializePeerConnection();
        setPeer(peer);
        setPeerId(id);
        onConnectionEstablished(id);
        
        peer.on('connection', (conn: any) => {
          setConnection(conn);
          setTransferStatus("connecting");
          
          conn.on('open', () => {
            toast({
              title: "Connection Established",
              description: "Ready to transfer files",
            });
            setTransferStatus("idle");
          });
        });
      } catch (error) {
        console.error("Failed to initialize peer connection:", error);
        toast({
          title: "Connection Error",
          description: "Failed to initialize peer connection",
          variant: "destructive",
        });
      }
    };
    
    setupPeer();
    
    return () => {
      if (peer) {
        peer.destroy();
      }
    };
  }, [onConnectionEstablished, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const processEntries = async (entry: FileSystemEntry) => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      fileEntry.file((file) => {
        setFiles(prev => [...prev, file]);
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      setDirectories(prev => [...prev, dirEntry]);
      
      const reader = dirEntry.createReader();
      // Read all entries within the directory
      const readEntries = () => {
        reader.readEntries(async (entries) => {
          if (entries.length > 0) {
            for (const entry of entries) {
              await processEntries(entry);
            }
            // Continue reading if there might be more entries
            readEntries();
          }
        }, (error) => {
          console.error("Error reading directory entries:", error);
        });
      };
      
      readEntries();
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        
        // WebkitGetAsEntry is used for accessing file system entries
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            await processEntries(entry);
          }
        } else if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            setFiles(prev => [...prev, file]);
          }
        }
      }
    } else {
      // Handle regular files
      const droppedFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  }, []);

  const handleDirectoryInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const sendFiles = useCallback(async () => {
    if (!connection || files.length === 0) {
      toast({
        title: "Cannot Send Files",
        description: connection ? "No files selected" : "No active connection",
        variant: "destructive",
      });
      return;
    }

    setTransferStatus("transferring");
    
    // Send file metadata first
    const fileMetadata = files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    }));
    
    connection.send({
      type: 'metadata',
      files: fileMetadata
    });
    
    // Send each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = `file-${i}`;
      
      // Send file in chunks
      const chunkSize = 16384; // 16KB chunks
      const chunks = Math.ceil(file.size / chunkSize);
      
      for (let j = 0; j < chunks; j++) {
        const offset = j * chunkSize;
        const chunk = file.slice(offset, offset + chunkSize);
        
        // Update progress
        const progress = Math.round(((j + 1) / chunks) * 100);
        setTransferProgress(prev => ({
          ...prev,
          [fileId]: progress
        }));
        
        // Send chunk with metadata
        connection.send({
          type: 'chunk',
          fileIndex: i,
          chunkIndex: j,
          totalChunks: chunks,
          data: await chunk.arrayBuffer()
        });
        
        // Small delay to prevent overwhelming the connection
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    // Signal transfer completion
    connection.send({
      type: 'complete'
    });
    
    setTransferStatus("completed");
    toast({
      title: "Transfer Complete",
      description: `Successfully sent ${files.length} files`,
    });
  }, [connection, files, toast]);

  return (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-medium">Drag files or folders here</h3>
        <p className="mt-1 text-sm text-gray-500">Or select them manually</p>
        
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
          >
            Select Files
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => directoryInputRef.current?.click()}
          >
            Select Folder
          </Button>
        </div>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          multiple
          className="hidden"
        />
        
        <input
          type="file"
          ref={directoryInputRef}
          onChange={handleDirectoryInputChange}
          // Use the attributes as a string (TypeScript workaround)
          // @ts-ignore
          webkitdirectory=""
          // @ts-ignore
          directory=""
          multiple
          className="hidden"
        />
      </div>

      {(files.length > 0 || directories.length > 0) && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-2">Selected Items ({files.length} files)</h3>
          
          <div className="max-h-60 overflow-y-auto space-y-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <FileType className="h-5 w-5 text-gray-500" />
                  <span className="text-sm truncate max-w-xs">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                
                <div className="flex items-center">
                  {transferProgress[`file-${index}`] !== undefined && (
                    <div className="w-24 mr-2">
                      <Progress value={transferProgress[`file-${index}`]} className="h-2" />
                    </div>
                  )}
                  
                  <button
                    onClick={() => removeFile(index)}
                    className="text-gray-500 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4">
            <Button 
              onClick={sendFiles} 
              disabled={files.length === 0 || transferStatus === "transferring"}
              className="w-full"
            >
              {transferStatus === "transferring" ? "Sending..." : 
               transferStatus === "completed" ? "Sent Successfully" : "Send Files"}
            </Button>
          </div>
        </div>
      )}
      
      {transferStatus === "completed" && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200 flex items-center">
          <Check className="h-5 w-5 text-green-500 mr-2" />
          <span>Transfer completed successfully!</span>
        </div>
      )}
      
      {peerId && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="font-medium">Your Connection ID</p>
          <div className="flex items-center mt-1">
            <code className="bg-white px-3 py-1 rounded border flex-1 overflow-x-auto">
              {peerId}
            </code>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2"
              onClick={() => {
                navigator.clipboard.writeText(peerId);
                toast({
                  title: "Copied",
                  description: "Connection ID copied to clipboard",
                });
              }}
            >
              Copy
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Share this ID with the receiver so they can connect to you
          </p>
        </div>
      )}
    </div>
  );
};

export default FileTransferZone;
