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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
  <div className="w-full max-w-md border border-gray-300 rounded-lg shadow-lg"> 
    <div className="flex flex-col space-y-1.5 p-6 text-center">
      <div className="text-2xl font-semibold leading-none tracking-tight text-2xl font-bold">Collaborative Whiteboard</div>
      <div className="text-sm text-muted-foreground">Create or join a collaborative whiteboard session</div>
    </div>

    <div className="mb-2 px-6 pt-6 pb-2">
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
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Enter room ID to join"
          />
        </div>
        <button
          type="submit"
          className="w-full h-10 px-4 py-2 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
        >
          Join Room
        </button>
      </form>
    </div>

    <div className="text-center p-6 pt-0"> 
      <p className="text-gray-600 mb-4">or</p>
      <button
        onClick={handleCreateRoom}
        className="h-10 px-4 py-2 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 w-full bg-primary text-primary-foreground hover:bg-primary/90 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
      >
        Create New Room
      </button>
    </div>
  </div>
</div>
  );
}
