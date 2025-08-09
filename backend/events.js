const utils = require('./utils'); // Import utilities

// Socket.IO events
const DRAW = 'drawing';
const CLEAR_CANVAS = 'clear-canvas';
const JOIN_ROOM = 'join-room';
const TEXT_UPDATE = 'text-update';
const PERIODIC_SAVE = 'periodic-save';
const USERS_COUNT = 'users-count'; 
const LOAD_INITIAL = 'load-initial';
const SAVE_CONFIRMED = 'save-confirmed';
const SAVE_FAILED = 'save-failed';
const SEND_MESSAGE = 'send-message';
const RECEIVE_MESSAGE = 'receive-message';
const USER_JOINED = 'user-joined';
const USER_LEFT = 'user-left';
const GET_ROOM_PARTICIPANTS = 'get-room-participants';
const ROOM_PARTICIPANTS = 'room-participants';
const PERMISSION_DENIED = 'permission-denied';
const TOGGLE_ROOM_LOCK = 'toggle-room-lock';
const ROOM_LOCK_STATUS_CHANGED = 'room-lock-status-changed';
const TRANSFER_HOST = 'transfer-host';
const HOST_CHANGED = 'host-changed';
const KICK_USER = 'kick-user';
const USER_KICKED = 'user-kicked';
const YOU_WERE_KICKED = 'you-were-kicked';
const END_ROOM_SESSION = 'end-room-session';
const ROOM_SESSION_ENDED = 'room-session-ended';
const ROOM_JOINED_SUCCESSFULLY = 'room-joined-successfully'; 
const BRUSH_UPDATE = 'brush-update'; 

const LOAD_CANVAS_HISTORY = 'load_canvas_history'; 

const eventNames = {
  DRAW, CLEAR_CANVAS, JOIN_ROOM, TEXT_UPDATE, PERIODIC_SAVE, USERS_COUNT,
  LOAD_INITIAL, SAVE_CONFIRMED, SAVE_FAILED, SEND_MESSAGE, RECEIVE_MESSAGE,
  USER_JOINED, USER_LEFT, GET_ROOM_PARTICIPANTS, ROOM_PARTICIPANTS,
  PERMISSION_DENIED, TOGGLE_ROOM_LOCK, ROOM_LOCK_STATUS_CHANGED,
  TRANSFER_HOST, HOST_CHANGED, KICK_USER, USER_KICKED, YOU_WERE_KICKED,
  END_ROOM_SESSION, ROOM_SESSION_ENDED, LOAD_CANVAS_HISTORY, ROOM_JOINED_SUCCESSFULLY, 
  BRUSH_UPDATE, 
};

const joinRoomHandler = require('./handlers/joinRoom');
const sendMessageHandler = require('./handlers/sendMessage');
const getRoomParticipantsHandler = require('./handlers/getRoomParticipants');
const drawHandler = require('./handlers/draw');
const textUpdateHandler = require('./handlers/textUpdate');

function handleSocketConnection(socket, io, roomManager, supabase, logToSupabase) {
  const state = {
    currentRoomId: null,
    currentUserId: socket.id,
    currentUserName: `User_${socket.id.substring(0, 5)}`,
    currentUserRole: 'viewer',
  };

  console.log(`[SERVER] New socket trying to connect, ID: ${socket.id}, Query: ${JSON.stringify(socket.handshake.query)}`);
  logToSupabase({
    type: 'USER_CONNECTED_SOCKET',
    userId: state.currentUserId,
    message: `User socket ${state.currentUserId} connected to server.`
  });

  socket.on(eventNames.JOIN_ROOM, joinRoomHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on(eventNames.SEND_MESSAGE, sendMessageHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on(eventNames.GET_ROOM_PARTICIPANTS, getRoomParticipantsHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on(eventNames.DRAW, drawHandler(io, socket, roomManager, supabase, logToSupabase, state));

  socket.on(eventNames.TEXT_UPDATE, async (textData) => {
    try {
      if (!currentRoomId) return;
      
      const permCheck = utils.canUserPerformEditAction(currentUserId, currentUserRole, currentRoomId, roomManager);
      if (!permCheck.allowed) {
        socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.TEXT_UPDATE, message: permCheck.message, code: permCheck.code });
        logToSupabase({ type: eventNames.PERMISSION_DENIED, roomId: currentRoomId, userId: currentUserId, message: `User ${currentUserName} denied action ${eventNames.TEXT_UPDATE}: ${permCheck.message}`, data: { action: eventNames.TEXT_UPDATE, code: permCheck.code } });
        return;
      }
      roomManager.updateRoomActivity(currentRoomId);
      socket.to(currentRoomId).emit(eventNames.TEXT_UPDATE, textData);

      
      try {
        const textAction = {
          room_id: currentRoomId,
          user_id: currentUserId,
          action_type: 'add_text',
          data: textData,
        };
        const { error: textError } = await supabase.from('canvas_draw_actions').insert([textAction]);
        if (textError) {
          console.error('Supabase error logging text action:', textError);
          logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Failed to log text action to canvas_draw_actions.', data: { error: { message: textError.message, code: textError.code, details: textError.details, hint: textError.hint, stack: textError.stack } } });
        }
      } catch (error) {
        console.error('Exception logging text action:', error);
        logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Exception when logging text action.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
      }

     
      try {
        const timestamp = new Date().toISOString();
        const { error: roomUpdateError } = await supabase.from('rooms').update({ textData, updated_at: timestamp }).eq('id', currentRoomId);
        if (roomUpdateError) {
          console.error('Supabase error updating room textdata snapshot:', roomUpdateError);
          logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Failed to update room textdata snapshot.', data: { error: { message: roomUpdateError.message, code: roomUpdateError.code, details: roomUpdateError.details, hint: roomUpdateError.hint, stack: roomUpdateError.stack } } });
        }
      } catch (error) {
        console.error('Exception updating room textdata snapshot:', error);
        logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Exception when updating room textdata snapshot.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
      }
    } catch (err) {
      console.error('Error in TEXT_UPDATE event handler:', err);
      logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: `Error in TEXT_UPDATE event: ${err.message}`, data: { error: { message: err.message, code: err.code, details: err.details, hint: err.hint, stack: err.stack }, function: 'textUpdateHandler' } });
    }
  });

  socket.on(eventNames.PERIODIC_SAVE, async ({ canvasData, textData }) => {
    try {
      if (!currentRoomId) return;

      const permCheck = utils.canUserPerformEditAction(currentUserId, currentUserRole, currentRoomId, roomManager);
      if (!permCheck.allowed) {
        socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.PERIODIC_SAVE, message: permCheck.message, code: permCheck.code });
        logToSupabase({ type: eventNames.PERMISSION_DENIED, roomId: currentRoomId, userId: currentUserId, message: `User ${currentUserName} denied action ${eventNames.PERIODIC_SAVE}: ${permCheck.message}`, data: { action: eventNames.PERIODIC_SAVE, code: permCheck.code } });
        return;
      }
      roomManager.updateRoomActivity(currentRoomId);
      const timestamp = new Date().toISOString();
      await supabase.from('rooms').update({ canvasData, textData, updated_at: timestamp }).eq('id', currentRoomId)
        .then(({ error }) => {
          if (error) throw error;
          socket.emit(eventNames.SAVE_CONFIRMED, { timestamp });
          logToSupabase({ type: 'DATA_SAVED', roomId: currentRoomId, userId: socket.id, message: `Data saved for room ${currentRoomId}. Trigger: periodic-save.`, data: { canvasLength: canvasData?.length, textLength: textData?.length } });
        });
    } catch (err) {
      console.error('Error in periodic save:', err);
      logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: socket.id, message: `Error in periodic save for room ${currentRoomId}. Error: ${err.message}`, data: { error: { message: err.message, code: err.code, details: err.details, hint: err.hint, stack: err.stack }, function: 'periodicSaveHandler' } });
      socket.emit(eventNames.SAVE_FAILED);
    }
  });

  socket.on(eventNames.CLEAR_CANVAS, async () => {
    try {
      if (!currentRoomId) return;
  
      const permCheck = utils.canUserPerformEditAction(currentUserId, currentUserRole, currentRoomId, roomManager);
      if (!permCheck.allowed) {
        socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.CLEAR_CANVAS, message: permCheck.message, code: permCheck.code });
        logToSupabase({ type: eventNames.PERMISSION_DENIED, roomId: currentRoomId, userId: currentUserId, message: `User ${currentUserName} denied action ${eventNames.CLEAR_CANVAS}: ${permCheck.message}`, data: { action: eventNames.CLEAR_CANVAS, code: permCheck.code } });
        return;
      }
      roomManager.updateRoomActivity(currentRoomId);
      socket.to(currentRoomId).emit(eventNames.CLEAR_CANVAS);

  
      try {
        const clearAction = {
          room_id: currentRoomId,
          user_id: currentUserId,
          action_type: 'clear_canvas',
          data: {},
        };
        const { error: clearError } = await supabase.from('canvas_draw_actions').insert([clearAction]);
        if (clearError) {
          console.error('Supabase error logging clear canvas action:', clearError);
          logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Failed to log clear_canvas action.', data: { error: { message: clearError.message, code: clearError.code, details: clearError.details, hint: clearError.hint, stack: clearError.stack } } });
        }
      } catch (error) {
        console.error('Exception logging clear canvas action:', error);
        logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Exception when logging clear_canvas action.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
      }

      try {
        const timestamp = new Date().toISOString();
        const { error: roomUpdateError } = await supabase.from('rooms').update({ canvasData: null, updated_at: timestamp }).eq('id', currentRoomId);
        if (roomUpdateError) {
          console.error('Supabase error updating room canvasdata for clear:', roomUpdateError);
          logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Failed to update room canvasdata for clear.', data: { error: { message: roomUpdateError.message, code: roomUpdateError.code, details: roomUpdateError.details, hint: roomUpdateError.hint, stack: roomUpdateError.stack } } });
        }
      } catch (error) {
        console.error('Exception updating room canvasdata for clear:', error);
        logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Exception when updating room canvasdata for clear.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
      }
      
    } catch (err) { 
      console.error('Error in CLEAR_CANVAS event handler:', err);
      logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: `Error in CLEAR_CANVAS event: ${err.message}`, data: { error: { message: err.message, code: err.code, details: err.details, hint: err.hint, stack: err.stack }, function: 'clearCanvasHandler' } });
    }
  });

  socket.on('disconnect', () => {
    
    logToSupabase({ type: 'USER_DISCONNECTED_SOCKET', userId: currentUserId, roomId: currentRoomId , message: `User socket ${currentUserId} disconnected.` });

    const roomsUserWasIn = roomManager.getRoomsForUser(currentUserId);

    roomsUserWasIn.forEach(async (rId) => {
      const currentUserNameForRoom = currentUserName;
      const wasHost = roomManager.getRoomHost(rId) === currentUserId;
      const removed = roomManager.removeParticipant(currentUserId, rId);

      if (removed) {
        
        try {
          const leftAction = {
            room_id: rId,
            user_id: currentUserId,
            action_type: 'user_left',
            details: { userName: currentUserNameForRoom }
          };
          const { error: leftLogError } = await supabase.from('user_actions_log').insert([leftAction]).select();
          if (leftLogError) {
            console.error('[RAW SUPABASE ERROR user_left_action]', leftLogError);
            console.error(`Supabase error logging user_left action for room ${rId}:`, leftLogError);
            logToSupabase({ type: 'LOGGING_ERROR', roomId: rId, userId: currentUserId, message: 'Failed to log user_left to user_actions_log.', data: { error: { message: leftLogError.message, code: leftLogError.code, details: leftLogError.details, hint: leftLogError.hint, stack: leftLogError.stack } } });
          }
        } catch (error) {
          console.error(`Exception logging user_left action for room ${rId}:`, error);
          logToSupabase({ type: 'EXCEPTION_LOGGING_ERROR', roomId: rId, userId: currentUserId, message: 'Exception when logging user_left to user_actions_log.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
        }

        const remainingParticipants = roomManager.getRoomParticipants(rId);
        io.to(rId).emit(eventNames.USER_LEFT, { userId: currentUserId, userName: currentUserNameForRoom });
        if (remainingParticipants) {
          io.to(rId).emit(eventNames.USERS_COUNT, remainingParticipants.length);
          if (wasHost && remainingParticipants.length > 0) {
            const newHost = roomManager.getRoomHost(rId);
            if (newHost) {
              io.to(rId).emit(eventNames.HOST_CHANGED, { roomId: rId, newHostId: newHost, oldHostId: currentUserId });
              io.to(rId).emit(eventNames.ROOM_PARTICIPANTS, remainingParticipants);
            }
          }
        } else {
          io.to(rId).emit(eventNames.USERS_COUNT, 0);
        }
      }
    });
  });

  socket.on(eventNames.TOGGLE_ROOM_LOCK, (data, callback) => {
    if (!currentRoomId) { if (callback) callback({ success: false, error: "Not in a room." }); return; }
    
    if (!utils.isUserHost(currentUserId, currentRoomId, roomManager)) {
      socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.TOGGLE_ROOM_LOCK, message: 'Only the host can lock/unlock the room.' });
      if (callback) callback({ success: false, error: 'Permission denied.' }); return;
    }
   
    const result = roomManager.toggleRoomLock(currentRoomId, currentUserId);
    if (result.success) {
      io.to(currentRoomId).emit(eventNames.ROOM_LOCK_STATUS_CHANGED, { roomId: currentRoomId, isLocked: result.isLocked, lockedBy: currentUserId });
      roomManager.updateRoomActivity(currentRoomId);

      try {
        const lockAction = {
          room_id: currentRoomId,
          user_id: currentUserId,
          action_type: result.isLocked ? 'room_locked' : 'room_unlocked',
          details: { isLocked: result.isLocked, performedBy: currentUserName }
        };
        async function insertlockAction(lockAction) {
          const { error: lockLogError } = await supabase.from('chat_messages').insert([lockAction]);
          if (lockLogError) {
            console.error("Insert failed:", lockLogError);
          }
        }
        insertlockAction(lockAction);

        if (lockLogError) {
          console.error('Supabase error logging room_lock_toggled action:', lockLogError);
          logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Failed to log room_lock_toggled action.', data: { error: { message: lockLogError.message, code: lockLogError.code, details: lockLogError.details, hint: lockLogError.hint, stack: lockLogError.stack } } });
        }
      } catch (error) {
        console.error('Exception logging room_lock_toggled action:', error);
        logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Exception when logging room_lock_toggled action.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
      }
      try {
        const lockAction = {
          room_id: currentRoomId,
          user_id: currentUserId,
          action_type: result.isLocked ? 'room_locked' : 'room_unlocked',
          details: { isLocked: result.isLocked, performedBy: currentUserName }
        };
        async function insertlockAction(lockAction) {
          const { error: lockLogError } = await supabase.from('chat_messages').insert([lockAction]).select();
          if (lockLogError) {
            console.error("Insert failed:", lockLogError);
          }
        }
        insertlockAction(lockAction);

        if (lockLogError) {
          console.error('[RAW SUPABASE ERROR room_lock_toggled_action]', lockLogError);
          console.error('Supabase error logging room_lock_toggled action:', lockLogError);
          logToSupabase({ type: 'LOGGING_ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Failed to log room_lock_toggled to user_actions_log.', data: { error: { message: lockLogError.message, code: lockLogError.code, details: lockLogError.details, hint: lockLogError.hint, stack: lockLogError.stack } } });
        }
      } catch (error) {
        console.error('Exception logging room_lock_toggled action:', error);
        logToSupabase({ type: 'EXCEPTION_LOGGING_ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Exception when logging room_lock_toggled to user_actions_log.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
      }
      if (callback) callback({ success: true, isLocked: result.isLocked });
    } else {
      if (callback) callback({ success: false, error: result.message });
    }
  });

  socket.on(eventNames.TRANSFER_HOST, (data, callback) => {
    const { newHostId } = data;
    if (!currentRoomId || !newHostId) { if (callback) callback({ success: false, error: 'Missing room or new host ID.' }); return; }
    
    if (!utils.isUserHost(currentUserId, currentRoomId, roomManager)) {
      socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.TRANSFER_HOST, message: 'Only the host can transfer host role.' });
      if (callback) callback({ success: false, error: 'Permission denied.' }); return;
    }
    const result = roomManager.transferHost(currentRoomId, currentUserId, newHostId);
    if (result.success) {
      currentUserRole = 'editor';
      io.to(currentRoomId).emit(eventNames.HOST_CHANGED, { roomId: currentRoomId, newHostId: newHostId, oldHostId: currentUserId });
      io.to(currentRoomId).emit(eventNames.ROOM_PARTICIPANTS, roomManager.getRoomParticipants(currentRoomId));
      roomManager.updateRoomActivity(currentRoomId);

      // Log to user_actions_log
      try {
        const newHostDetails = roomManager.getRoomParticipants(currentRoomId)?.find(p => p.userId === newHostId);
        const transferAction = {
          room_id: currentRoomId,
          user_id: currentUserId, 
          action_type: 'host_transferred',
          details: { oldHostId: currentUserId, oldHostUserName: currentUserName, newHostId: newHostId, newHostUserName: newHostDetails?.userName || newHostId }
        };
        async function inserttransferAction(transferAction) {
          const { error: transferLogError } = await supabase.from('user_actions_log')
            .insert([transferAction]);
          if (transferLogError) {
            console.error("Insert failed:", transferLogError);
          }
        }
        inserttransferAction(transferAction);
        if (transferLogError) {
          console.error('Supabase error logging host_transferred action:', transferLogError);
          logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Failed to log host_transferred action.', data: { error: { message: transferLogError.message, code: transferLogError.code, details: transferLogError.details, hint: transferLogError.hint, stack: transferLogError.stack } } });
        }
      } catch (error) {
        console.error('Exception logging host_transferred action:', error);
        logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Exception when logging host_transferred action.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
      }
      
      try {
        const newHostDetails = roomManager.getRoomParticipants(currentRoomId)?.find(p => p.userId === newHostId);
        const transferAction = {
          room_id: currentRoomId,
          user_id: currentUserId,
          action_type: 'host_transferred',
          details: { oldHostId: currentUserId, oldHostUserName: currentUserName, newHostId: newHostId, newHostUserName: newHostDetails?.userName || newHostId }
        };
        async function inserttransferAction(transferAction) {
          const { error: transferLogError } = await supabase.from('user_actions_log')
            .insert([transferAction]).select();
          if (transferLogError) {
            console.error("Insert failed:", transferLogError);
          }
        }
        inserttransferAction(transferAction);
        if (transferLogError) {
          console.error('[RAW SUPABASE ERROR host_transferred_action]', transferLogError);
          console.error('Supabase error logging host_transferred action:', transferLogError);
          logToSupabase({ type: 'LOGGING_ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Failed to log host_transferred to user_actions_log.', data: { error: { message: transferLogError.message, code: transferLogError.code, details: transferLogError.details, hint: transferLogError.hint, stack: transferLogError.stack } } });
        }
      } catch (error) {
        console.error('Exception logging host_transferred action:', error);
        logToSupabase({ type: 'EXCEPTION_LOGGING_ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Exception when logging host_transferred to user_actions_log.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
      }
      if (callback) callback({ success: true });
    } else {
      if (callback) callback({ success: false, error: result.message });
    }
  });

  socket.on(eventNames.KICK_USER, (data, callback) => {
    const { userIdToKick } = data;
    if (!currentRoomId || !userIdToKick) { if (callback) callback({ success: false, error: 'Missing room or user ID to kick.' }); return; }
    // Use utility to check for host
    if (!utils.isUserHost(currentUserId, currentRoomId, roomManager)) {
      socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.KICK_USER, message: 'Only the host can kick users.' });
      if (callback) callback({ success: false, error: 'Permission denied.' }); return;
    }
    if (userIdToKick === currentUserId) { if (callback) callback({ success: false, error: 'Cannot kick yourself.' }); return; }
    const participants = roomManager.getRoomParticipants(currentRoomId); 
    const userToKickDetails = participants?.find(p => p.userId === userIdToKick);
    if (!userToKickDetails) { if (callback) callback({ success: false, error: 'User not found in this room.' }); return; }

    const wasKickedUserHost = roomManager.getRoomHost(currentRoomId) === userIdToKick;
    const removed = roomManager.removeParticipant(userIdToKick, currentRoomId);

    if (removed) {
      const kickedSocket = io.sockets.sockets.get(userIdToKick);
      if (kickedSocket) {
        kickedSocket.emit(eventNames.YOU_WERE_KICKED, { roomId: currentRoomId, reason: 'Kicked by host.' });
        kickedSocket.leave(currentRoomId);
      }
      io.to(currentRoomId).emit(eventNames.USER_LEFT, { userId: userIdToKick, userName: userToKickDetails.userName, reason: 'kicked' });
      const remainingParticipants = roomManager.getRoomParticipants(currentRoomId);
      io.to(currentRoomId).emit(eventNames.USERS_COUNT, remainingParticipants ? remainingParticipants.length : 0);

    
      try {
        const kickAction = {
          room_id: currentRoomId,
          user_id: currentUserId, 
          action_type: 'user_kicked',
          details: { kickedUserId: userIdToKick, kickedUserName: userToKickDetails.userName, kickedBy: currentUserName }
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
          logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Failed to log user_kicked action.', data: { error: { message: kickLogError.message, code: kickLogError.code, details: kickLogError.details, hint: kickLogError.hint, stack: kickLogError.stack } } });
        }
      } catch (error) {
        console.error('Exception logging user_kicked action:', error);
        logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Exception when logging user_kicked action.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
      }

      if (wasKickedUserHost && remainingParticipants && remainingParticipants.length > 0) {
        const newHost = roomManager.getRoomHost(currentRoomId);
        if (newHost) {
          io.to(currentRoomId).emit(eventNames.HOST_CHANGED, { roomId: currentRoomId, newHostId: newHost, oldHostId: userIdToKick });
          io.to(currentRoomId).emit(eventNames.ROOM_PARTICIPANTS, remainingParticipants);
        }
      }
      roomManager.updateRoomActivity(currentRoomId);
      try {
        const kickAction = {
          room_id: currentRoomId,
          user_id: currentUserId,
          action_type: 'user_kicked',
          details: { kickedUserId: userIdToKick, kickedUserName: userToKickDetails.userName, kickedBy: currentUserName }
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
          logToSupabase({ type: 'LOGGING_ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Failed to log user_kicked to user_actions_log.', data: { error: { message: kickLogError.message, code: kickLogError.code, details: kickLogError.details, hint: kickLogError.hint, stack: kickLogError.stack } } });
        }
      } catch (error) {
        console.error('Exception logging user_kicked action:', error);
        logToSupabase({ type: 'EXCEPTION_LOGGING_ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Exception when logging user_kicked to user_actions_log.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
      }
      if (callback) callback({ success: true });
    } else {
      if (callback) callback({ success: false, error: 'Failed to remove user.' });
    }
  });

  socket.on(eventNames.END_ROOM_SESSION, (data, callback) => {
    if (!currentRoomId) { if (callback) callback({ success: false, error: 'Not in a room.' }); return; }
    // Use utility to check for host
    if (!utils.isUserHost(currentUserId, currentRoomId, roomManager)) {
      socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.END_ROOM_SESSION, message: 'Only the host can end the session.' });
      if (callback) callback({ success: false, error: 'Permission denied.' }); return;
    }
    io.to(currentRoomId).emit(eventNames.ROOM_SESSION_ENDED, { roomId: currentRoomId });
    const socketsInRoom = io.sockets.adapter.rooms.get(currentRoomId);
    if (socketsInRoom) {
      socketsInRoom.forEach(socketId => {
        const sock = io.sockets.sockets.get(socketId);
        if (sock) sock.leave(currentRoomId);
      });
    }
    try {
      const endSessionAction = {
        room_id: currentRoomId,
        user_id: currentUserId,
        action_type: 'room_ended',
        details: { endedBy: currentUserName }
      };
      async function insertendSessionAction(endSessionAction) {
        const { error: endLogError } = await supabase.from('user_actions_log')
          .insert([endSessionAction]);
        if (endLogError) {
          console.error("Insert failed:", endLogError);
        }
      }
      insertendSessionAction(endSessionAction);
      if (endLogError) {
          console.error('Supabase error logging room_ended action:', endLogError);
          logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Failed to log room_ended action.', data: { error: { message: endLogError.message, code: endLogError.code, details: endLogError.details, hint: endLogError.hint, stack: endLogError.stack } } });
      }
    } catch (error) {
        console.error('Exception logging room_ended action:', error);
        logToSupabase({ type: 'ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Exception when logging room_ended action.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
    }

    roomManager.removeAllParticipants(currentRoomId);
    
    try {
      const endSessionAction = {
        room_id: currentRoomId,
        user_id: currentUserId,
        action_type: 'room_ended',
        details: { endedBy: currentUserName }
      };
      async function insertendSessionAction(endSessionAction) {
        const { error: endLogError } = await supabase.from('user_actions_log')
          .insert([endSessionAction]).select();
        if (endLogError) {
          console.error("Insert failed:", endLogError);
        }
      }
      insertendSessionAction(endSessionAction);
      if (endLogError) {
        console.error('[RAW SUPABASE ERROR room_ended_action]', endLogError);
        console.error('Supabase error logging room_ended action:', endLogError);
        logToSupabase({ type: 'LOGGING_ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Failed to log room_ended to user_actions_log.', data: { error: { message: endLogError.message, code: endLogError.code, details: endLogError.details, hint: endLogError.hint, stack: endLogError.stack } } });
      }
    } catch (error) {
      console.error('Exception logging room_ended action:', error);
      logToSupabase({ type: 'EXCEPTION_LOGGING_ERROR', roomId: currentRoomId, userId: currentUserId, message: 'Exception when logging room_ended to user_actions_log.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
    }
    currentRoomId = null;
    if (callback) callback({ success: true });
  });

  socket.on(eventNames.BRUSH_UPDATE, ({ color, width }) => {
    try {
      if (!currentRoomId) {
        console.warn(`User ${currentUserId} tried to update brush without being in a room.`);
        return;
      }

      const permCheck = utils.canUserPerformEditAction(currentUserId, currentUserRole, currentRoomId, roomManager);
      if (!permCheck.allowed) {
        socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.BRUSH_UPDATE, message: permCheck.message, code: permCheck.code });
        logToSupabase({
          type: eventNames.PERMISSION_DENIED,
          roomId: currentRoomId,
          userId: currentUserId,
          message: `User ${currentUserName} denied action ${eventNames.BRUSH_UPDATE}: ${permCheck.message}`,
          data: { action: eventNames.BRUSH_UPDATE, code: permCheck.code }
        });
        return;
      }

      roomManager.updateRoomActivity(currentRoomId);
     
      socket.to(currentRoomId).emit(eventNames.BRUSH_UPDATE, { userId: currentUserId, userName: currentUserName, color, width });

      logToSupabase({
        type: 'BRUSH_SETTINGS_UPDATED',
        roomId: currentRoomId,
        userId: currentUserId,
        message: `User ${currentUserName} updated brush settings.`,
        data: { color, width }
      });

    } catch (err) {
      console.error(`Error in ${eventNames.BRUSH_UPDATE} event handler:`, err);
      logToSupabase({
        type: 'ERROR',
        roomId: currentRoomId,
        userId: currentUserId,
        message: `Error in ${eventNames.BRUSH_UPDATE} event: ${err.message}`,
        data: { error: { message: err.message, code: err.code, details: err.details, hint: err.hint, stack: err.stack }, function: 'brushUpdateHandler' }
      });
    }
  });
}

module.exports = {
  handleSocketConnection,
  eventNames,
};