
import { useState, useCallback, useEffect } from "react";
import { Download, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { initializePeerConnection } from "@/lib/peerConnection";

const ReceiverMode = () => {
  const [peerId, setPeerId] = useState<string>("");
  const [connectionId, setConnectionId] = useState<string>("");
  const [peer, setPeer] = useState<any>(null);
  const [connection, setConnection] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [receivedFiles, setReceivedFiles] = useState<{name: string, url: string, size: number}[]>([]);
  const [incomingFiles, setIncomingFiles] = useState<{name: string, size: number, index: number}[]>([]);
  const [fileProgress, setFileProgress] = useState<{[key: string]: number}>({});
  const { toast } = useToast();
  
  const [fileChunks, setFileChunks] = useState<{[key: string]: ArrayBuffer[]}>({});

  useEffect(() => {
    const setupPeer = async () => {
      try {
        const { peer, id } = await initializePeerConnection();
        setPeer(peer);
        setPeerId(id);
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
  }, [toast]);

  const connectToPeer = useCallback(() => {
    if (!peer || !connectionId.trim()) {
      toast({
        title: "Connection Error",
        description: "Please enter a valid connection ID",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setConnectionStatus("connecting");
      
      const conn = peer.connect(connectionId);
      setConnection(conn);
      
      conn.on('open', () => {
        setConnectionStatus("connected");
        toast({
          title: "Connected",
          description: "Ready to receive files",
        });
      });
      
      conn.on('error', (err: any) => {
        console.error("Connection error:", err);
        setConnectionStatus("disconnected");
        toast({
          title: "Connection Error",
          description: err.message || "Failed to connect to peer",
          variant: "destructive",
        });
      });
      
      conn.on('close', () => {
        setConnectionStatus("disconnected");
        toast({
          title: "Disconnected",
          description: "Connection closed",
        });
      });
      
      conn.on('data', handleIncomingData);
    } catch (error) {
      console.error("Failed to connect:", error);
      setConnectionStatus("disconnected");
      toast({
        title: "Connection Error",
        description: "Failed to connect to peer",
        variant: "destructive",
      });
    }
  }, [peer, connectionId, toast]);

  const handleIncomingData = useCallback((data: any) => {
    if (data.type === 'metadata') {
      // Received file metadata
      setIncomingFiles(data.files.map((file: any, index: number) => ({
        ...file,
        index
      })));
      
      // Initialize file chunks storage
      const chunksStorage: {[key: string]: ArrayBuffer[]} = {};
      data.files.forEach((file: any, index: number) => {
        chunksStorage[`file-${index}`] = [];
      });
      setFileChunks(chunksStorage);
      
      toast({
        title: "Receiving Files",
        description: `${data.files.length} files incoming`,
      });
    } 
    else if (data.type === 'chunk') {
      // Received a file chunk
      const { fileIndex, chunkIndex, totalChunks, data: chunkData } = data;
      const fileId = `file-${fileIndex}`;
      
      // Store the chunk
      setFileChunks(prev => {
        const updatedChunks = { ...prev };
        if (!updatedChunks[fileId]) {
          updatedChunks[fileId] = [];
        }
        updatedChunks[fileId][chunkIndex] = chunkData;
        return updatedChunks;
      });
      
      // Update progress
      const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
      setFileProgress(prev => ({
        ...prev,
        [fileId]: progress
      }));
      
      // If all chunks received, create the file
      if (progress === 100) {
        setTimeout(() => {
          assembleFile(fileIndex);
        }, 100);
      }
    } 
    else if (data.type === 'complete') {
      // Transfer completed
      toast({
        title: "Transfer Complete",
        description: "All files received successfully",
      });
    }
  }, [toast]);

  const assembleFile = useCallback((fileIndex: number) => {
    const fileId = `file-${fileIndex}`;
    const fileInfo = incomingFiles.find(file => file.index === fileIndex);
    
    if (!fileInfo || !fileChunks[fileId]) return;
    
    // Filter out any undefined chunks and combine chunks into one buffer
    const chunks = fileChunks[fileId].filter(chunk => chunk !== undefined);
    const combinedSize = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const fullBuffer = new Uint8Array(combinedSize);
    
    let offset = 0;
    for (const chunk of chunks) {
      fullBuffer.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    
    // Create blob and download URL
    const blob = new Blob([fullBuffer], { type: fileInfo.type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    // Add to received files
    setReceivedFiles(prev => [
      ...prev,
      {
        name: fileInfo.name,
        url,
        size: fileInfo.size
      }
    ]);
    
    // Clean up chunks to free memory
    setFileChunks(prev => {
      const updated = { ...prev };
      delete updated[fileId];
      return updated;
    });
  }, [incomingFiles, fileChunks]);

  const downloadFile = useCallback((url: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-medium mb-4">Connect to Sender</h3>
        
        <div className="space-y-4">
          {connectionStatus === "disconnected" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter Sender's Connection ID
                </label>
                <div className="flex space-x-2">
                  <Input
                    value={connectionId}
                    onChange={(e) => setConnectionId(e.target.value)}
                    placeholder="Paste connection ID here"
                    className="flex-1"
                  />
                  <Button onClick={connectToPeer}>Connect</Button>
                </div>
              </div>
              
              {peerId && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm font-medium">Your Connection ID</p>
                  <code className="text-xs block bg-white mt-1 p-2 rounded border overflow-x-auto">
                    {peerId}
                  </code>
                </div>
              )}
            </>
          )}
          
          {connectionStatus === "connecting" && (
            <div className="text-center p-6">
              <div className="animate-pulse">
                <p className="font-medium text-blue-600">Connecting...</p>
              </div>
            </div>
          )}
          
          {connectionStatus === "connected" && (
            <div className="flex items-center text-green-600 space-x-2">
              <Check className="h-5 w-5" />
              <span>Connected and ready to receive files</span>
            </div>
          )}
        </div>
      </div>
      
      {incomingFiles.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-medium mb-4">Incoming Files</h3>
          
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {incomingFiles.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <Download className="h-5 w-5 text-gray-500" />
                  <span className="text-sm truncate max-w-xs">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                
                <div className="w-24">
                  <Progress 
                    value={fileProgress[`file-${file.index}`] || 0} 
                    className="h-2" 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {receivedFiles.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-medium mb-4">Received Files</h3>
          
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {receivedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded border border-green-100">
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-sm truncate max-w-xs">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => downloadFile(file.url, file.name)}
                >
                  Save
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiverMode;
