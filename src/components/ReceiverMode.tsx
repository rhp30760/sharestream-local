
import { useState, useCallback, useEffect } from "react";
import { Download, Check, X, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { listFiles, getFileMetadata, getFileBlobUrl, deleteFile } from "@/lib/localServer";

interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
}

const ReceiverMode = () => {
  const [availableFiles, setAvailableFiles] = useState<FileInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<{id: string, name: string, url: string, size: number}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const refreshFileList = useCallback(async () => {
    setIsLoading(true);
    try {
      const files = listFiles();
      setAvailableFiles(files);
    } catch (error) {
      console.error("Failed to fetch files:", error);
      toast({
        title: "Error",
        description: "Failed to fetch available files",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refreshFileList();
  }, [refreshFileList]);

  const downloadFile = useCallback((fileId: string) => {
    const file = availableFiles.find(f => f.id === fileId);
    if (!file) return;
    
    try {
      const url = getFileBlobUrl(fileId);
      if (!url) {
        toast({
          title: "Download Error",
          description: "File data is not available on this device",
          variant: "destructive",
        });
        return;
      }
      
      // Add to selected files
      setSelectedFiles(prev => {
        // Check if file is already in selected files
        if (prev.some(f => f.id === fileId)) {
          return prev; // File already selected
        }
        
        return [
          ...prev,
          {
            id: fileId,
            name: file.name,
            url,
            size: file.size
          }
        ];
      });
      
      toast({
        title: "File Selected",
        description: `${file.name} is ready to save`,
      });
    } catch (error) {
      console.error("Error downloading file:", error);
      toast({
        title: "Selection Error",
        description: "Failed to prepare file",
        variant: "destructive",
      });
    }
  }, [availableFiles, toast]);

  const saveFile = useCallback((url: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const removeSelectedFile = useCallback((fileId: string) => {
    setSelectedFiles(prev => prev.filter(file => file.id !== fileId));
    toast({
      title: "File Removed",
      description: "File removed from selection",
    });
  }, [toast]);

  const removeAvailableFile = useCallback((fileId: string) => {
    // Remove from both available files and selected files
    if (deleteFile(fileId)) {
      setAvailableFiles(prev => prev.filter(file => file.id !== fileId));
      setSelectedFiles(prev => prev.filter(file => file.id !== fileId));
      toast({
        title: "File Deleted",
        description: "File has been deleted",
      });
    } else {
      toast({
        title: "Delete Failed",
        description: "Could not delete the file",
        variant: "destructive",
      });
    }
  }, [toast]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Available Files</h3>
          <Button 
            variant="outline" 
            size="sm"
            onClick={refreshFileList}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        {isLoading ? (
          <div className="text-center p-6">
            <div className="animate-pulse">
              <p className="font-medium text-blue-600">Loading files...</p>
            </div>
          </div>
        ) : availableFiles.length === 0 ? (
          <div className="text-center p-6 bg-gray-50 rounded">
            <p className="text-gray-500">No files available for download</p>
            <p className="text-sm text-gray-400 mt-2">
              Ask someone to share files with you on this network
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {availableFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <Download className="h-5 w-5 text-gray-500" />
                  <span className="text-sm truncate max-w-xs">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadFile(file.id)}
                  >
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeAvailableFile(file.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-medium mb-4">Selected Files</h3>
          
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded border border-green-100">
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-sm truncate max-w-xs">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => saveFile(file.url, file.name)}
                  >
                    Save
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => removeSelectedFile(file.id)}
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiverMode;
