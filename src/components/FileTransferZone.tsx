
import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileType, Folder, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { storeFile, listFiles, getFileMetadata } from "@/lib/localServer";

interface FileTransferZoneProps {
  onFilesStored: (fileIds: string[]) => void;
}

const FileTransferZone = ({ onFilesStored }: FileTransferZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "completed">("idle");
  const [shareUrl, setShareUrl] = useState<string>("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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

  const uploadFiles = useCallback(async () => {
    if (files.length === 0) {
      toast({
        title: "Cannot Upload Files",
        description: "No files selected",
        variant: "destructive",
      });
      return;
    }

    setUploadStatus("uploading");
    const fileIds: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = `file-${i}`;
      
      try {
        // Update progress to indicate starting upload
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: 10
        }));
        
        // Store the file and get its ID
        const storedFileId = await storeFile(file);
        fileIds.push(storedFileId);
        
        // Update progress to indicate completion
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: 100
        }));
      } catch (error) {
        console.error("Error uploading file:", error);
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }
    
    setUploadStatus("completed");
    onFilesStored(fileIds);
    
    toast({
      title: "Upload Complete",
      description: `Successfully uploaded ${files.length} files`,
    });
    
    // Generate a share URL
    const shareUrl = window.location.origin + '?mode=receive';
    setShareUrl(shareUrl);
  }, [files, toast, onFilesStored]);

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

      {files.length > 0 && (
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
                  {uploadProgress[`file-${index}`] !== undefined && (
                    <div className="w-24 mr-2">
                      <Progress value={uploadProgress[`file-${index}`]} className="h-2" />
                    </div>
                  )}
                  
                  <button
                    onClick={() => removeFile(index)}
                    className="text-gray-500 hover:text-red-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4">
            <Button 
              onClick={uploadFiles} 
              disabled={files.length === 0 || uploadStatus === "uploading"}
              className="w-full"
            >
              {uploadStatus === "uploading" ? "Uploading..." : 
               uploadStatus === "completed" ? "Upload Complete" : "Share Files"}
            </Button>
          </div>
        </div>
      )}
      
      {uploadStatus === "completed" && shareUrl && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <h3 className="font-medium mb-2">Share Link</h3>
          <div className="flex items-center mt-1">
            <code className="bg-white px-3 py-1 rounded border flex-1 overflow-x-auto text-sm">
              {shareUrl}
            </code>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2 whitespace-nowrap"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                toast({
                  title: "Copied",
                  description: "Share link copied to clipboard",
                });
              }}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Anyone on your network can access these files using this link
          </p>
        </div>
      )}
    </div>
  );
};

export default FileTransferZone;
