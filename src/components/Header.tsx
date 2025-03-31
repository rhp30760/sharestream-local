
import { Share } from "lucide-react";

const Header = () => {
  return (
    <header className="bg-white shadow-sm py-4">
      <div className="container mx-auto px-4 flex items-center justify-between max-w-5xl">
        <div className="flex items-center space-x-2">
          <Share className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">LocalShare</h1>
        </div>
        <div>
          <span className="text-sm text-gray-500">Local Network Transfers</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
