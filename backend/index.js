
const ROOM_INACTIVITY_THRESHOLD = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL = 60 * 60 * 1000; 

const activeRooms = new Map(); 

function cleanupInactiveRooms() {
  console.log('Running inactive room cleanup');
  const currentTime = Date.now();
  const roomsToCheck = [...activeRooms.keys()];
  
  roomsToCheck.forEach(async (roomId) => {
    const roomData = activeRooms.get(roomId);
    
    
    if (roomData.users.size === 0 && 
        (currentTime - roomData.lastActivity) > ROOM_INACTIVITY_THRESHOLD) {
      console.log(`Deleting inactive room: ${roomId}`);
      
      try {
        
        const { error } = await supabase
          .from('rooms')
          .delete()
          .eq('id', roomId);
          
        if (error) {
          console.error(`Error deleting room ${roomId}:`, error);
        } else {
          
          activeRooms.delete(roomId);
          console.log(`Room ${roomId} deleted successfully`);
        }
      } catch (err) {
        console.error(`Exception during room cleanup for ${roomId}:`, err);
      }
    }
  });
}


function startCleanupInterval() {
  setInterval(cleanupInactiveRooms, CLEANUP_INTERVAL);
  console.log(`Room cleanup service started, will run every ${CLEANUP_INTERVAL/1000/60} minutes`);
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  let currentRoomId = null;
  
  // room join
  socket.on('join-room', async (roomId, callback) => {
    try {
      // Leave previous room
      if (currentRoomId) {
        socket.leave(currentRoomId);
        const roomData = activeRooms.get(currentRoomId);
        if (roomData) {
          roomData.users.delete(socket.id);
          roomData.lastActivity = Date.now();
          
          // update user count
          io.to(currentRoomId).emit('users-count', roomData.users.size);
        }
      }
      
      // Join new room
      currentRoomId = roomId;
      socket.join(roomId);
      
      // Track users with timestamp
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, { 
          users: new Set(),
          lastActivity: Date.now()
        });
      }
      
      const roomData = activeRooms.get(roomId);
      roomData.users.add(socket.id);
      roomData.lastActivity = Date.now();
      
      // Load room data 
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      
      // send data
      if (data) {
        socket.emit('load-initial', { 
          canvasData: data.canvasData, 
          textData: data.textData,
          updatedAt: data.updated_at
        });
      } else {
        // Create new room
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
      
      // shoe user count
      const usersCount = roomData.users.size;
      io.to(roomId).emit('users-count', usersCount);
      
      if (callback) callback({ success: true, usersCount });
    } catch (err) {
      console.error('Error handling join-room:', err);
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // drawing updates/activities 
  socket.on('drawing', async (canvasData) => {
    try {
      if (!currentRoomId) return;
      
      // last activity timestamp
      const roomData = activeRooms.get(currentRoomId);
      if (roomData) {
        roomData.lastActivity = Date.now();
      }
      
      // show drawing 
      socket.to(currentRoomId).emit('drawing', canvasData);
      
      // Save to supabase
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

  // text activities
  socket.on('text-update', async (textData) => {
    try {
      if (!currentRoomId) return;
      
      // last activity timestamp
      const roomData = activeRooms.get(currentRoomId);
      if (roomData) {
        roomData.lastActivity = Date.now();
      }
      
      // show to users
      socket.to(currentRoomId).emit('text-update', textData);
      
      // Save to supabase
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

  // autosave
  socket.on('periodic-save', async ({ canvasData, textData }) => {
    try {
      if (!currentRoomId) return;
      
      
      const roomData = activeRooms.get(currentRoomId);
      if (roomData) {
        roomData.lastActivity = Date.now();
      }
      
      // Save to supabase
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
          // confirm saving with time 
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
    console.log(`User disconnected: ${socket.id}`);
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


server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Connected to Supabase at ${supabaseUrl}`);
  startCleanupInterval();
});
