const { eventNames } = require('../events');

module.exports = (io, socket, roomManager, supabase, logToSupabase, state) => () => {
  logToSupabase({ type: 'USER_DISCONNECTED_SOCKET', userId: state.currentUserId, roomId: state.currentRoomId, message: `User socket ${state.currentUserId} disconnected.` });

  const roomsUserWasIn = roomManager.getRoomsForUser(state.currentUserId);

  roomsUserWasIn.forEach(async (rId) => {
    const currentUserNameForRoom = state.currentUserName;
    const wasHost = roomManager.getRoomHost(rId) === state.currentUserId;
    const removed = roomManager.removeParticipant(state.currentUserId, rId);

    if (removed) {

      try {
        const leftAction = {
          room_id: rId,
          user_id: state.currentUserId,
          action_type: 'user_left',
          details: { userName: currentUserNameForRoom }
        };
        const { error: leftLogError } = await supabase.from('user_actions_log').insert([leftAction]).select();
        if (leftLogError) {
          console.error('[RAW SUPABASE ERROR user_left_action]', leftLogError);
          console.error(`Supabase error logging user_left action for room ${rId}:`, leftLogError);
          logToSupabase({ type: 'LOGGING_ERROR', roomId: rId, userId: state.currentUserId, message: 'Failed to log user_left to user_actions_log.', data: { error: { message: leftLogError.message, code: leftLogError.code, details: leftLogError.details, hint: leftLogError.hint, stack: leftLogError.stack } } });
        }
      } catch (error) {
        console.error(`Exception logging user_left action for room ${rId}:`, error);
        logToSupabase({ type: 'EXCEPTION_LOGGING_ERROR', roomId: rId, userId: state.currentUserId, message: 'Exception when logging user_left to user_actions_log.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
      }

      const remainingParticipants = roomManager.getRoomParticipants(rId);
      io.to(rId).emit(eventNames.USER_LEFT, { userId: state.currentUserId, userName: currentUserNameForRoom });
      if (remainingParticipants) {
        io.to(rId).emit(eventNames.USERS_COUNT, remainingParticipants.length);
        if (wasHost && remainingParticipants.length > 0) {
          const newHost = roomManager.getRoomHost(rId);
          if (newHost) {
            io.to(rId).emit(eventNames.HOST_CHANGED, { roomId: rId, newHostId: newHost, oldHostId: state.currentUserId });
            io.to(rId).emit(eventNames.ROOM_PARTICIPANTS, remainingParticipants);
          }
        }
      } else {
        io.to(rId).emit(eventNames.USERS_COUNT, 0);
      }
    }
  });
};
