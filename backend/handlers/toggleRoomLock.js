const { eventNames } = require('../events');
const utils = require('../utils');

module.exports = (io, socket, roomManager, supabase, logToSupabase, state) => (data, callback) => {
  if (!state.currentRoomId) {
    if (callback) callback({ success: false, error: "Not in a room." });
    return;
  }

  if (!utils.isUserHost(state.currentUserId, state.currentRoomId, roomManager)) {
    socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.TOGGLE_ROOM_LOCK, message: 'Only the host can lock/unlock the room.' });
    if (callback) callback({ success: false, error: 'Permission denied.' });
    return;
  }

  const result = roomManager.toggleRoomLock(state.currentRoomId, state.currentUserId);
  if (result.success) {
    io.to(state.currentRoomId).emit(eventNames.ROOM_LOCK_STATUS_CHANGED, { roomId: state.currentRoomId, isLocked: result.isLocked, lockedBy: state.currentUserId });
    roomManager.updateRoomActivity(state.currentRoomId);

    try {
      const lockAction = {
        room_id: state.currentRoomId,
        user_id: state.currentUserId,
        action_type: result.isLocked ? 'room_locked' : 'room_unlocked',
        details: { isLocked: result.isLocked, performedBy: state.currentUserName }
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
        logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Failed to log room_lock_toggled action.', data: { error: { message: lockLogError.message, code: lockLogError.code, details: lockLogError.details, hint: lockLogError.hint, stack: lockLogError.stack } } });
      }
    } catch (error) {
      console.error('Exception logging room_lock_toggled action:', error);
      logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Exception when logging room_lock_toggled action.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
    }
    try {
      const lockAction = {
        room_id: state.currentRoomId,
        user_id: state.currentUserId,
        action_type: result.isLocked ? 'room_locked' : 'room_unlocked',
        details: { isLocked: result.isLocked, performedBy: state.currentUserName }
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
        logToSupabase({ type: 'LOGGING_ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Failed to log room_lock_toggled to user_actions_log.', data: { error: { message: lockLogError.message, code: lockLogError.code, details: lockLogError.details, hint: lockLogError.hint, stack: lockLogError.stack } } });
      }
    } catch (error) {
      console.error('Exception logging room_lock_toggled action:', error);
      logToSupabase({ type: 'EXCEPTION_LOGGING_ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Exception when logging room_lock_toggled to user_actions_log.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
    }
    if (callback) callback({ success: true, isLocked: result.isLocked });
  } else {
    if (callback) callback({ success: false, error: result.message });
  }
};
