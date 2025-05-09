require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server and Socket.io instance
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  } 
});

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_KEY must be provided in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Track active rooms and users
const activeRooms = new Map();

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    
    if (error) throw error;
    
    if (data) {
      res.json({ 
        roomId: data.id, 
        canvasData: data.canvasData, 
        textData: data.textData,
        updatedAt: data.updated_at,
        usersCount: activeRooms.get(roomId)?.size || 0
      });
    } else {
      res.status(404).json({ error: 'Room not found' });
    }
  } catch (err) {
    console.error('Error fetching room:', err);
    res.status(500).json({ error: 'Failed to fetch room data' });
  }
});

// Socket.io event handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  let currentRoomId = null;
  
  // Handle room join
  socket.on('join-room', async (roomId, callback) => {
    try {
      // Leave previous room if any
      if (currentRoomId) {
        socket.leave(currentRoomId);
        const roomUsers = activeRooms.get(currentRoomId);
        if (roomUsers) {
          roomUsers.delete(socket.id);
          if (roomUsers.size === 0) {
            activeRooms.delete(currentRoomId);
          } else {
            // Broadcast updated user count
            io.to(currentRoomId).emit('users-count', roomUsers.size);
          }
        }
      }
      
      // Join new room
      currentRoomId = roomId;
      socket.join(roomId);
      
      // Track user in room
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Set());
      }
      activeRooms.get(roomId).add(socket.id);
      
      // Load room data from database
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      
      // If room exists, send data to client
      if (data) {
        socket.emit('load-initial', { 
          canvasData: data.canvasData, 
          textData: data.textData,
          updatedAt: data.updated_at
        });
      } else {
        // Create new room if it doesn't exist
        const timestamp = new Date().toISOString();
        await supabase.from('rooms').insert({ 
          id: roomId, 
          canvasData: null, 
          textData: '',
          created_at: timestamp,
          updated_at: timestamp
        });
        socket.emit('load-initial', { 
          canvasData: null, 
          textData: '',
          updatedAt: timestamp
        });
      }
      
      // Broadcast updated user count
      const usersCount = activeRooms.get(roomId).size;
      io.to(roomId).emit('users-count', usersCount);
      
      if (callback) callback({ success: true, usersCount });
    } catch (err) {
      console.error('Error handling join-room:', err);
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Handle drawing updates
  socket.on('drawing', async (canvasData) => {
    try {
      if (!currentRoomId) return;
      
      // Broadcast to other users in the same room
      socket.to(currentRoomId).emit('drawing', canvasData);
      
      // Save to database
      const timestamp = new Date().toISOString();
      await supabase
        .from('rooms')
        .update({ 
          canvasData,
          updated_at: timestamp
        })
        .eq('id', currentRoomId);
    } catch (err) {
      console.error('Error saving drawing:', err);
    }
  });

  // Handle text updates
  socket.on('text-update', async (textData) => {
    try {
      if (!currentRoomId) return;
      
      // Broadcast to other users in the same room
      socket.to(currentRoomId).emit('text-update', textData);
      
      // Save to database
      const timestamp = new Date().toISOString();
      await supabase
        .from('rooms')
        .update({ 
          textData,
          updated_at: timestamp
        })
        .eq('id', currentRoomId);
    } catch (err) {
      console.error('Error saving text:', err);
    }
  });

  // Handle canvas clear
  socket.on('clear-canvas', async () => {
    try {
      if (!currentRoomId) return;
      
      // Broadcast to other users in the same room
      socket.to(currentRoomId).emit('clear-canvas');
      
      // Save to database
      const timestamp = new Date().toISOString();
      await supabase
        .from('rooms')
        .update({ 
          canvasData: null,
          updated_at: timestamp
        })
        .eq('id', currentRoomId);
    } catch (err) {
      console.error('Error clearing canvas:', err);
    }
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    if (currentRoomId) {
      const roomUsers = activeRooms.get(currentRoomId);
      if (roomUsers) {
        roomUsers.delete(socket.id);
        if (roomUsers.size === 0) {
          activeRooms.delete(currentRoomId);
        } else {
          // Broadcast updated user count
          io.to(currentRoomId).emit('users-count', roomUsers.size);
        }
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Connected to Supabase at ${supabaseUrl}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
