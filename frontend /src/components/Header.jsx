import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Header({ roomId, isConnected, activeUsers, lastUpdated, toggleSidebar }) {
  const [isCopied, setIsCopied] = useState(false);
  
  const copyRoomLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };
  
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-gray-800 mr-6">
              Whiteboard
            </Link>
            <div className="hidden md:flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-500">Room:</span>
              <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded">{roomId}</span>
              <button
                onClick={copyRoomLink}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {isCopied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center">
              <span 
                className={`inline-block w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
              ></span>
              <span className="text-sm text-gray-600">
                {isConnected ? `${activeUsers} online` : 'Disconnected'}
              </span>
            </div>
            
            {lastUpdated && (
              <div className="hidden md:block text-sm text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
            
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none"
              aria-label="Toggle text panel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}