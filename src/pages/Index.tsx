
import { useState } from "react";
import FileTransferZone from "@/components/FileTransferZone";
import ReceiverMode from "@/components/ReceiverMode";
import Header from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const { toast } = useToast();
  const [connectionId, setConnectionId] = useState<string>("");

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <Tabs defaultValue="send" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="send">Send Files</TabsTrigger>
            <TabsTrigger value="receive">Receive Files</TabsTrigger>
          </TabsList>
          
          <TabsContent value="send" className="space-y-4">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Send Files Locally</h1>
              <p className="text-gray-600">Transfer files directly to devices on your network</p>
            </div>
            
            <FileTransferZone 
              onConnectionEstablished={(id) => {
                setConnectionId(id);
                toast({
                  title: "Connection Ready",
                  description: `Share this ID with the receiver: ${id}`,
                });
              }}
            />
          </TabsContent>
          
          <TabsContent value="receive" className="space-y-4">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Receive Files</h1>
              <p className="text-gray-600">Connect to a sender to receive files</p>
            </div>
            
            <ReceiverMode />
          </TabsContent>
        </Tabs>
      </main>
      
      <footer className="py-6 text-center text-gray-500 text-sm">
        <p>Local File Transfer - No size limits, no bandwidth throttling</p>
      </footer>
    </div>
  );
};

export default Index;
