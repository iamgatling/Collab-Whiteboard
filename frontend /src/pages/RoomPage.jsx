import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Whiteboard from '../components/Whiteboard';
import TextEditor from '../components/TextEditor';
import Header from '../components/Header';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [activeUsers, setActiveUsers] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }
    
    // Initialize socket connection
    const socketInstance = io(SOCKET_URL);
    setSocket(socketInstance);
    
    // Socket event handlers
    socketInstance.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      socketInstance.emit('join-room', roomId, (response) => {
        if (!response.success) {
          console.error('Failed to join room:', response.error);
        }
      });
    });
    
    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });
    
    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
    });
    
    socketInstance.on('load-initial', (data) => {
      console.log('Received initial data');
      setInitialData(data);
      if (data.updatedAt) {
        setLastUpdated(new Date(data.updatedAt));
      }
    });
    
    socketInstance.on('users-count', (count) => {
      setActiveUsers(count);
    });
    
    // Cleanup
    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [roomId, navigate]);
  
  // Toggle sidebar
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  if (!roomId) {
    return null;
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header 
        roomId={roomId} 
        isConnected={isConnected} 
        activeUsers={activeUsers} 
        lastUpdated={lastUpdated}
        toggleSidebar={toggleSidebar}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Whiteboard */}
          <div className="flex-1 p-4 overflow-auto min-h-[50vh] lg:min-h-0">
            <Whiteboard 
              socket={socket} 
              initialCanvasData={initialData?.canvasData}
              setLastUpdated={setLastUpdated}
            />
          </div>
          
          {/* Text Panel */}
          {isSidebarOpen && (
            <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 p-4 flex flex-col overflow-hidden">
              <TextEditor 
                socket={socket} 
                initialText={initialData?.textData || ''}
                setLastUpdated={setLastUpdated}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}