require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

console.log('Allowed frontend URL:', process.env.FRONTEND_URL);
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  } 
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_KEY must be provided in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const activeRooms = new Map();

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

const ROOM_INACTIVITY_THRESHOLD = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL = 60 * 60 * 1000; 

function cleanupInactiveRooms() {
  const currentTime = Date.now();
  const roomsToCheck = [...activeRooms.keys()];
  
  roomsToCheck.forEach(async (roomId) => {
    const roomData = activeRooms.get(roomId);
    if (roomData.users.size === 0 && 
        (currentTime - roomData.lastActivity) > ROOM_INACTIVITY_THRESHOLD) {
      try {
        const { error } = await supabase
          .from('rooms')
          .delete()
          .eq('id', roomId);
          
        if (error) {
          console.error(`Error deleting room ${roomId}:`, error);
        } else {
          activeRooms.delete(roomId);
        }
      } catch (err) {
        console.error(`Exception during room cleanup for ${roomId}:`, err);
      }
    }
  });
}

function startCleanupInterval() {
  setInterval(cleanupInactiveRooms, CLEANUP_INTERVAL);
}

io.on('connection', (socket) => {
  let currentRoomId = null;
  
  socket.on('join-room', async (roomId, callback) => {
    try {
      if (currentRoomId) {
        socket.leave(currentRoomId);
        const roomData = activeRooms.get(currentRoomId);
        if (roomData) {
          roomData.users.delete(socket.id);
          roomData.lastActivity = Date.now();
          io.to(currentRoomId).emit('users-count', roomData.users.size);
        }
      }
      
      currentRoomId = roomId;
      socket.join(roomId);
      
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, { 
          users: new Set(),
          lastActivity: Date.now()
        });
      }
      
      const roomData = activeRooms.get(roomId);
      roomData.users.add(socket.id);
      roomData.lastActivity = Date.now();
      
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      
      if (data) {
        socket.emit('load-initial', { 
          canvasData: data.canvasData, 
          textData: data.textData,
          updatedAt: data.updated_at
        });
      } else {
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
      
      const usersCount = roomData.users.size;
      io.to(roomId).emit('users-count', usersCount);
      
      if (callback) callback({ success: true, usersCount });
    } catch (err) {
      console.error('Error handling join-room:', err);
      if (callback) callback({ success: false, error: err.message });
    }
  });

  socket.on('drawing', async (canvasData) => {
    try {
      if (!currentRoomId) return;
      const roomData = activeRooms.get(currentRoomId);
      if (roomData) {
        roomData.lastActivity = Date.now();
      }
      
      socket.to(currentRoomId).emit('drawing', canvasData);
      
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

  socket.on('text-update', async (textData) => {
    try {
      if (!currentRoomId) return;
      const roomData = activeRooms.get(currentRoomId);
      if (roomData) {
        roomData.lastActivity = Date.now();
      }
      
      socket.to(currentRoomId).emit('text-update', textData);
      
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

  socket.on('periodic-save', async ({ canvasData, textData }) => {
    try {
      if (!currentRoomId) return;
      const roomData = activeRooms.get(currentRoomId);
      if (roomData) {
        roomData.lastActivity = Date.now();
      }
      
      const timestamp = new Date().toISOString();
      await supabase
        .from('rooms')
        .update({ 
          canvasData,
          textData,
          updated_at: timestamp
        })
        .eq('id', currentRoomId)
        .then(({ error }) => {
          if (error) {
            throw error;
          }
          socket.emit('save-confirmed', { timestamp });
        });
    } catch (err) {
      console.error('Error in periodic save:', err);
      socket.emit('save-failed');
    }
  });

  socket.on('clear-canvas', async () => {
    try {
      if (!currentRoomId) return;
      const roomData = activeRooms.get(currentRoomId);
      if (roomData) {
        roomData.lastActivity = Date.now();
      }
      
      socket.to(currentRoomId).emit('clear-canvas');
      
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

  socket.on('disconnect', () => {
    if (currentRoomId) {
      const roomData = activeRooms.get(currentRoomId);
      if (roomData) {
        roomData.users.delete(socket.id);
        roomData.lastActivity = Date.now();
        if (roomData.users.size > 0) {
          io.to(currentRoomId).emit('users-count', roomData.users.size);
        }
      }
    }
  });
});

server.listen(process.env.PORT || 4000, () => {
  console.log(`Backend running on port ${process.env.PORT || 4000}`);
  console.log(`Connected to Supabase at ${supabaseUrl}`);
  startCleanupInterval();
});
