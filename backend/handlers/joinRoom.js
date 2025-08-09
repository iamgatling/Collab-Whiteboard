const { eventNames } = require('../events');
const utils = require('../utils');

module.exports = (io, socket, roomManager, supabase, logToSupabase, state) => async (data, callback) => {
  console.log(`[SERVER] Socket ${socket.id} sent ${eventNames.JOIN_ROOM} with data:`, data);
  const { roomId, userName, role } = data;
  try {
    if (state.currentRoomId && state.currentRoomId !== roomId) {
      socket.leave(state.currentRoomId);
      const oldRoomParticipants = roomManager.getRoomParticipants(state.currentRoomId);
      io.to(state.currentRoomId).emit(eventNames.USERS_COUNT, oldRoomParticipants ? oldRoomParticipants.length : 0);
      socket.to(state.currentRoomId).emit(eventNames.USER_LEFT, { userId: state.currentUserId, userName: state.currentUserName });
      roomManager.removeParticipant(state.currentUserId, state.currentRoomId);
      logToSupabase({
        type: eventNames.USER_LEFT,
        roomId: state.currentRoomId,
        userId: state.currentUserId,
        message: `User ${state.currentUserName} (${state.currentUserId}) left room ${state.currentRoomId}.`,
        data: { userName: state.currentUserName, role: state.currentUserRole }
      });
    }
    state.currentRoomId = roomId;
    state.currentUserName = userName || `User_${state.currentUserId.substring(0, 5)}`;
    const isLocked = roomManager.isRoomLocked(roomId);

    if (isLocked && !utils.isUserHost(state.currentUserId, roomId, roomManager)) {
      if (callback) callback({ success: false, error: 'Room is locked.', code: 'ROOM_LOCKED' });
      logToSupabase({ type: 'JOIN_ROOM_DENIED', roomId, userId: state.currentUserId, message: 'Join denied: Room is locked.' });
      return;
    }

    let assignedRole;
    const existingParticipants = roomManager.getRoomParticipants(roomId);
    if (!existingParticipants || existingParticipants.length === 0) {
      assignedRole = 'host';
    } else {
      assignedRole = (role === 'viewer') ? 'viewer' : (role || 'editor');
    }
    state.currentUserRole = assignedRole;

    socket.join(roomId);
    roomManager.addParticipant(roomId, state.currentUserId, state.currentUserName, state.currentUserRole);
    roomManager.updateRoomActivity(roomId);
    const { data: roomDbData, error: dbError } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    if (dbError && dbError.code !== 'PGRST116') throw dbError;
    if (roomDbData) {
      socket.emit(eventNames.LOAD_INITIAL, { canvasData: roomDbData.canvasData, textData: roomDbData.textData, updatedAt: roomDbData.updated_at });
    } else {
      const timestamp = new Date().toISOString();
      await supabase.from('rooms').insert({ id: roomId, canvasData: null, textData: '', created_at: timestamp, updated_at: timestamp });
      logToSupabase({ type: 'ROOM_CREATED', roomId: roomId, message: `Room ${roomId} implicitly created.` });
      socket.emit(eventNames.LOAD_INITIAL, { canvasData: null, textData: '', updatedAt: timestamp });
    }
    const participants = roomManager.getRoomParticipants(roomId);
    socket.emit(eventNames.ROOM_PARTICIPANTS, participants);
    socket.to(roomId).emit(eventNames.USER_JOINED, { userId: state.currentUserId, userName: state.currentUserName, role: state.currentUserRole });
    io.to(roomId).emit(eventNames.USERS_COUNT, participants ? participants.length : 0);


    try {
      const joinAction = {
        room_id: state.currentRoomId,
        user_id: state.currentUserId,
        action_type: 'user_joined',
        details: { userName: state.currentUserName, role: state.currentUserRole },
        created_at: new Date().toISOString()
      };

      const { error: joinLogError } = await supabase
        .from('user_actions_log')
        .insert([joinAction]);

      if (joinLogError) {
        console.error('[RAW SUPABASE ERROR user_joined_action]', JSON.stringify(joinLogError, Object.getOwnPropertyNames(joinLogError), 2));

        await logToSupabase({
          type: 'LOGGING_ERROR',
          roomId: state.currentRoomId,
          userId: state.currentUserId,
          message: 'Failed to log user_joined to user_actions_log.',
          data: {
            error: {
              message: joinLogError.message,
              code: joinLogError.code,
              details: joinLogError.details,
              hint: joinLogError.hint,
              stack: joinLogError.stack
            }
          }
        });
      }
    } catch (error) {
      console.error('Exception logging user_joined action:', error);

      await logToSupabase({
        type: 'EXCEPTION_LOGGING_ERROR',
        roomId: state.currentRoomId,
        userId: state.currentUserId,
        message: 'Exception when logging user_joined to user_actions_log.',
        data: {
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            stack: error.stack
          }
        }
      });
    }

    // Load and send canvas history
    try {
      const { data: history, error: historyError } = await supabase
        .from('canvas_draw_actions')
        .select('*')
        .eq('room_id', state.currentRoomId)
        .order('created_at', { ascending: true });

      if (historyError) {
        console.error('Supabase error fetching canvas history:', historyError);
        logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Failed to fetch canvas history.', data: { error: { message: historyError.message, code: historyError.code, details: historyError.details, hint: historyError.hint, stack: historyError.stack } } });

      }

      if (history) {
        socket.emit(eventNames.LOAD_CANVAS_HISTORY, { history });
      }
    } catch (error) {
      console.error('Exception fetching canvas history:', error);
      logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Exception when fetching canvas history.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
    }


    const roomJoinedSuccessfullyPayload = {
      success: true,
      roomId: state.currentRoomId,
      userId: state.currentUserId,
      role: state.currentUserRole,
      participants: participants
    };
    console.log(`[SERVER] Emitting ${eventNames.ROOM_JOINED_SUCCESSFULLY} to ${socket.id} with payload:`, roomJoinedSuccessfullyPayload);
    socket.emit(eventNames.ROOM_JOINED_SUCCESSFULLY, roomJoinedSuccessfullyPayload);

    if (callback) callback({ success: true, participants });
  } catch (err) {
    console.error(`Error handling ${eventNames.JOIN_ROOM}:`, err);
    logToSupabase({ type: 'ERROR', roomId: roomId, userId: state.currentUserId, message: `Error handling ${eventNames.JOIN_ROOM} for room ${roomId}. Error: ${err.message}`, data: { error: { message: err.message, code: err.code, details: err.details, hint: err.hint, stack: err.stack }, function: 'join-room-handler' } });
    if (callback) callback({ success: false, error: err.message });
  }
};
