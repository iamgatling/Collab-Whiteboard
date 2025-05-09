import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

export default function HomePage() {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();
  
  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomId.trim()) {
      navigate(`/room/${roomId.trim()}`);
    }
  };
  
  const handleCreateRoom = () => {
    const newRoomId = uuidv4().substring(0, 8);
    navigate(`/room/${newRoomId}`);
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Collaborative Whiteboard
        </h1>
        
        <div className="mb-8">
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label htmlFor="roomId" className="block text-sm font-medium text-gray-700 mb-1">
                Enter Room ID
              </label>
              <input
                type="text"
                id="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter room ID to join"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Join Room
            </button>
          </form>
        </div>
        
        <div className="text-center">
          <p className="text-gray-600 mb-4">or</p>
          <button
            onClick={handleCreateRoom}
            className="w-full bg-gray-800 text-white py-2 px-4 rounded-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            Create New Room
          </button>
        </div>
      </div>
    </div>
  );
}