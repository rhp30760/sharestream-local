
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import FileTransferZone from "@/components/FileTransferZone";
import ReceiverMode from "@/components/ReceiverMode";
import Header from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'receive' ? 'receive' : 'send';
  const [sharedFileIds, setSharedFileIds] = useState<string[]>([]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <Tabs defaultValue={initialMode} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="send">Share Files</TabsTrigger>
            <TabsTrigger value="receive">Download Files</TabsTrigger>
          </TabsList>
          
          <TabsContent value="send" className="space-y-4">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Share Files Locally</h1>
              <p className="text-gray-600">Share files with any device on your network</p>
            </div>
            
            <FileTransferZone 
              onFilesStored={(fileIds) => {
                setSharedFileIds(fileIds);
              }}
            />
          </TabsContent>
          
          <TabsContent value="receive" className="space-y-4">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Download Files</h1>
              <p className="text-gray-600">Download files shared on your network</p>
            </div>
            
            <ReceiverMode />
          </TabsContent>
        </Tabs>
      </main>
      
      <footer className="py-6 text-center text-gray-500 text-sm">
        <p>LocalShare - Direct local network file sharing</p>
      </footer>
    </div>
  );
};

export default Index;
