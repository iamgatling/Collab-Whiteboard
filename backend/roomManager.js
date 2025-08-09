
const rooms = new Map(); 
const userToRooms = new Map(); 

function addParticipant(roomId, userId, userName, role) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      participants: new Map(),
      lastActivity: Date.now(),
      isLocked: false, 
      hostId: userId, 
    });
  }

  const room = rooms.get(roomId);
  room.participants.set(userId, { userName, role, joinedAt: new Date() });
  room.lastActivity = Date.now();
  if (role === 'host') {
      room.hostId = userId;
  }

  if (!userToRooms.has(userId)) {
    userToRooms.set(userId, new Set());
  }
  userToRooms.get(userId).add(roomId);

  console.log(`User ${userId} (${userName}, ${role}) added to room ${roomId}`);
  
}

function removeParticipant(userId, roomId) {
  const room = rooms.get(roomId);
  let removed = false;
  let wasHost = false;

  if (room && room.participants.has(userId)) {
    if (room.hostId === userId) {
      wasHost = true;
    }
    room.participants.delete(userId);
    room.lastActivity = Date.now();
    removed = true;
    console.log(`User ${userId} removed from room ${roomId}`);

    if (room.participants.size === 0) {
      console.log(`Room ${roomId} is now empty. Deleting room.`);
      rooms.delete(roomId); 
    } else if (wasHost) {
      
      const newHost = room.participants.keys().next().value; 
      if (newHost) {
          const newHostDetails = room.participants.get(newHost);
          if (newHostDetails) {
            newHostDetails.role = 'host'; 
            room.hostId = newHost;
            console.log(`Host ${userId} left room ${roomId}. New host is ${newHost}.`);
          }
      } else {
        console.log(`Room ${roomId} has participants but could not assign a new host.`);
        rooms.delete(roomId); 
      }
    }
  }

  const roomsForUser = userToRooms.get(userId);
  if (roomsForUser) {
    roomsForUser.delete(roomId);
    if (roomsForUser.size === 0) {
      userToRooms.delete(userId);
      console.log(`User ${userId} is no longer in any rooms.`);
    }
  }
 
  return removed;
}

function getRoomParticipants(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }
  return Array.from(room.participants.entries()).map(([userId, details]) => ({
    userId,
    ...details,
  }));
}

function getRoomsForUser(userId) {
  const roomSet = userToRooms.get(userId);
  return roomSet ? Array.from(roomSet) : [];
}


function updateRoomActivity(roomId) {
    if (rooms.has(roomId)) {
        rooms.get(roomId).lastActivity = Date.now();
    }
}

const INACTIVITY_THRESHOLD = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL = 60 * 60 * 1000;

function cleanupInactiveRooms() {
  const now = Date.now();
  console.log('Running cleanup for inactive rooms...');
  for (const [roomId, roomData] of rooms.entries()) {
    if (roomData.participants.size === 0 && (now - roomData.lastActivity > INACTIVITY_THRESHOLD)) {
      rooms.delete(roomId);
      console.log(`Cleaned up inactive room ${roomId}.`);
      for (const [userId, userRooms] of userToRooms.entries()) {
        if (userRooms.has(roomId)) {
          userRooms.delete(roomId);
          if (userRooms.size === 0) {
            userToRooms.delete(userId);
          }
        }
      }
    }
  }
}


function toggleRoomLock(roomId, currentHostId) {
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, message: 'Room not found.' };
  }
  if (room.hostId !== currentHostId) {
    return { success: false, message: 'Only the host can lock or unlock the room.' };
  }
  room.isLocked = !room.isLocked;
  room.lastActivity = Date.now();
  console.log(`Room ${roomId} lock status changed to: ${room.isLocked} by host ${currentHostId}`);
  return { success: true, isLocked: room.isLocked };
}

function isRoomLocked(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    return null; 
  }
  return room.isLocked;
}

function getRoomHost(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }
  return room.hostId || null; 
}

function transferHost(roomId, currentHostId, newHostId) {
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, message: 'Room not found.' };
  }
  if (room.hostId !== currentHostId) {
    return { success: false, message: 'Only the current host can transfer host role.' };
  }
  if (!room.participants.has(newHostId)) {
    return { success: false, message: 'New host not found in this room.' };
  }
  if (currentHostId === newHostId) {
    return { success: false, message: 'Cannot transfer host to self.' };
  }

  const oldHostDetails = room.participants.get(currentHostId);
  if (oldHostDetails) {
    oldHostDetails.role = 'editor';
  }

  const newHostDetails = room.participants.get(newHostId);
  if (newHostDetails) {
    newHostDetails.role = 'host';
  }
  
  room.hostId = newHostId;
  room.lastActivity = Date.now();
  console.log(`Host role in room ${roomId} transferred from ${currentHostId} to ${newHostId}`);
  return { success: true };
}

function removeAllParticipants(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, message: 'Room not found.' };
  }

  for (const userId of room.participants.keys()) {
    const userRooms = userToRooms.get(userId);
    if (userRooms) {
      userRooms.delete(roomId);
      if (userRooms.size === 0) {
        userToRooms.delete(userId);
      }
    }
  }
  
  rooms.delete(roomId);
  console.log(`All participants removed and session ended for room ${roomId}.`);
  return { success: true };
}

module.exports = {
  addParticipant,
  removeParticipant,
  getRoomParticipants,
  getRoomsForUser,
  updateRoomActivity,
  toggleRoomLock,
  isRoomLocked,
  getRoomHost,
  transferHost,
  removeAllParticipants,
};
