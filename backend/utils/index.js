
function isUserHost(userId, roomId, roomManager) {
  if (!roomId || !userId || !roomManager || typeof roomManager.getRoomHost !== 'function') {
    console.warn('isUserHost: Invalid parameters or roomManager missing getRoomHost.');
    return false;
  }
  return roomManager.getRoomHost(roomId) === userId;
}

function getUserRoleInRoom(userId, roomId, roomManager) {
  if (!roomId || !userId || !roomManager || typeof roomManager.getRoomParticipants !== 'function') {
    console.warn('getUserRoleInRoom: Invalid parameters or roomManager missing getRoomParticipants.');
    return null;
  }
  const participants = roomManager.getRoomParticipants(roomId);
  const user = participants?.find(p => p.userId === userId);
  return user ? user.role : null;
}

function canUserPerformEditAction(userId, userRole, roomId, roomManager) {
  if (!roomId || !userId || !userRole || !roomManager) {
    return { allowed: false, message: 'Invalid parameters for permission check.' };
  }

  const currentRoleFromManager = getUserRoleInRoom(userId, roomId, roomManager);
  if (!currentRoleFromManager) {
     
      return { allowed: false, message: 'User not found in room participants list.'};
  }

  const effectiveRole = currentRoleFromManager;


  if (effectiveRole === 'viewer') {
    return { allowed: false, message: 'Viewers cannot perform this action.', code: 'VIEWER_PROHIBITED' };
  }

  const isLocked = roomManager.isRoomLocked(roomId);
  if (isLocked) {
    if (!isUserHost(userId, roomId, roomManager)) {
      return { allowed: false, message: 'Room is locked. Only the host can perform this action.', code: 'ROOM_LOCKED_NOT_HOST' };
    }
  }
  
  return { allowed: true };
}


module.exports = {
  isUserHost,
  getUserRoleInRoom,
  canUserPerformEditAction,
};
