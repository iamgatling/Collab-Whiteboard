const { eventNames } = require('../events');
const utils = require('../utils');

module.exports = (io, socket, roomManager, supabase, logToSupabase, state) => (data, callback) => {
  const { userIdToKick } = data;
  if (!state.currentRoomId || !userIdToKick) {
    if (callback) callback({ success: false, error: 'Missing room or user ID to kick.' });
    return;
  }
  // Use utility to check for host
  if (!utils.isUserHost(state.currentUserId, state.currentRoomId, roomManager)) {
    socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.KICK_USER, message: 'Only the host can kick users.' });
    if (callback) callback({ success: false, error: 'Permission denied.' });
    return;
  }
  if (userIdToKick === state.currentUserId) {
    if (callback) callback({ success: false, error: 'Cannot kick yourself.' });
    return;
  }
  const participants = roomManager.getRoomParticipants(state.currentRoomId);
  const userToKickDetails = participants?.find(p => p.userId === userIdToKick);
  if (!userToKickDetails) {
    if (callback) callback({ success: false, error: 'User not found in this room.' });
    return;
  }

  const wasKickedUserHost = roomManager.getRoomHost(state.currentRoomId) === userIdToKick;
  const removed = roomManager.removeParticipant(userIdToKick, state.currentRoomId);

  if (removed) {
    const kickedSocket = io.sockets.sockets.get(userIdToKick);
    if (kickedSocket) {
      kickedSocket.emit(eventNames.YOU_WERE_KICKED, { roomId: state.currentRoomId, reason: 'Kicked by host.' });
      kickedSocket.leave(state.currentRoomId);
    }
    io.to(state.currentRoomId).emit(eventNames.USER_LEFT, { userId: userIdToKick, userName: userToKickDetails.userName, reason: 'kicked' });
    const remainingParticipants = roomManager.getRoomParticipants(state.currentRoomId);
    io.to(state.currentRoomId).emit(eventNames.USERS_COUNT, remainingParticipants ? remainingParticipants.length : 0);


    try {
      const kickAction = {
        room_id: state.currentRoomId,
        user_id: state.currentUserId,
        action_type: 'user_kicked',
        details: { kickedUserId: userIdToKick, kickedUserName: userToKickDetails.userName, kickedBy: state.currentUserName }
      };
      async function insertkickAction(kickAction) {
        const { error: kickLogError } = await supabase.from('user_actions_log')
          .insert([kickAction]);
        if (kickLogError) {
          console.error("Insert failed:", kickLogError);
        }
      }
      insertkickAction(kickAction);
      if (kickLogError) {
        console.error('Supabase error logging user_kicked action:', kickLogError);
        logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Failed to log user_kicked action.', data: { error: { message: kickLogError.message, code: kickLogError.code, details: kickLogError.details, hint: kickLogError.hint, stack: kickLogError.stack } } });
      }
    } catch (error) {
      console.error('Exception logging user_kicked action:', error);
      logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Exception when logging user_kicked action.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
    }

    if (wasKickedUserHost && remainingParticipants && remainingParticipants.length > 0) {
      const newHost = roomManager.getRoomHost(state.currentRoomId);
      if (newHost) {
        io.to(state.currentRoomId).emit(eventNames.HOST_CHANGED, { roomId: state.currentRoomId, newHostId: newHost, oldHostId: userIdToKick });
        io.to(state.currentRoomId).emit(eventNames.ROOM_PARTICIPANTS, remainingParticipants);
      }
    }
    roomManager.updateRoomActivity(state.currentRoomId);
    try {
      const kickAction = {
        room_id: state.currentRoomId,
        user_id: state.currentUserId,
        action_type: 'user_kicked',
        details: { kickedUserId: userIdToKick, kickedUserName: userToKickDetails.userName, kickedBy: state.currentUserName }
      };
      async function insertkickAction(kickAction) {
        const { error: kickLogError } = await supabase.from('user_actions_log')
          .insert([kickAction]).select();
        if (kickLogError) {
          console.error("Insert failed:", kickLogError);
        }
      }
      insertkickAction(kickAction);
      if (kickLogError) {
        console.error('[RAW SUPABASE ERROR user_kicked_action]', kickLogError);
        console.error('Supabase error logging user_kicked action:', kickLogError);
        logToSupabase({ type: 'LOGGING_ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Failed to log user_kicked to user_actions_log.', data: { error: { message: kickLogError.message, code: kickLogError.code, details: kickLogError.details, hint: kickLogError.hint, stack: kickLogError.stack } } });
      }
    } catch (error) {
      console.error('Exception logging user_kicked action:', error);
      logToSupabase({ type: 'EXCEPTION_LOGGING_ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Exception when logging user_kicked to user_actions_log.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
    }
    if (callback) callback({ success: true });
  } else {
    if (callback) callback({ success: false, error: 'Failed to remove user.' });
  }
};
