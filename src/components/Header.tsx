
import { useState, useEffect } from "react";
import { Share, Wifi } from "lucide-react";
import { getLocalIpAddress } from "@/lib/localServer";

const Header = () => {
  const [localIp, setLocalIp] = useState<string>("");
  const [port, setPort] = useState<string>(window.location.port || "5173"); // Default Vite port

  useEffect(() => {
    const fetchLocalIp = async () => {
      try {
        const ip = await getLocalIpAddress();
        setLocalIp(ip);
      } catch (error) {
        console.error("Failed to get local IP:", error);
      }
    };
    
    fetchLocalIp();
  }, []);

  return (
    <header className="bg-white shadow-sm py-4">
      <div className="container mx-auto px-4 flex flex-col md:flex-row md:items-center md:justify-between max-w-5xl">
        <div className="flex items-center space-x-2">
          <Share className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">LocalShare</h1>
        </div>
        
        {localIp && (
          <div className="mt-2 md:mt-0 flex items-center text-sm">
            <Wifi className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-gray-600">Share on network:</span>
            <code className="bg-gray-100 px-2 py-1 rounded ml-2 text-blue-600">
              http://{localIp}:{port}
            </code>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
