const { eventNames } = require('../events');
const utils = require('../utils');

module.exports = (io, socket, roomManager, supabase, logToSupabase, state) => (data, callback) => {
  const { newHostId } = data;
  if (!state.currentRoomId || !newHostId) {
    if (callback) callback({ success: false, error: 'Missing room or new host ID.' });
    return;
  }

  if (!utils.isUserHost(state.currentUserId, state.currentRoomId, roomManager)) {
    socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.TRANSFER_HOST, message: 'Only the host can transfer host role.' });
    if (callback) callback({ success: false, error: 'Permission denied.' });
    return;
  }
  const result = roomManager.transferHost(state.currentRoomId, state.currentUserId, newHostId);
  if (result.success) {
    state.currentUserRole = 'editor';
    io.to(state.currentRoomId).emit(eventNames.HOST_CHANGED, { roomId: state.currentRoomId, newHostId: newHostId, oldHostId: state.currentUserId });
    io.to(state.currentRoomId).emit(eventNames.ROOM_PARTICIPANTS, roomManager.getRoomParticipants(state.currentRoomId));
    roomManager.updateRoomActivity(state.currentRoomId);

    // Log to user_actions_log
    try {
      const newHostDetails = roomManager.getRoomParticipants(state.currentRoomId)?.find(p => p.userId === newHostId);
      const transferAction = {
        room_id: state.currentRoomId,
        user_id: state.currentUserId,
        action_type: 'host_transferred',
        details: { oldHostId: state.currentUserId, oldHostUserName: state.currentUserName, newHostId: newHostId, newHostUserName: newHostDetails?.userName || newHostId }
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
        logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Failed to log host_transferred action.', data: { error: { message: transferLogError.message, code: transferLogError.code, details: transferLogError.details, hint: transferLogError.hint, stack: transferLogError.stack } } });
      }
    } catch (error) {
      console.error('Exception logging host_transferred action:', error);
      logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Exception when logging host_transferred action.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
    }

    try {
      const newHostDetails = roomManager.getRoomParticipants(state.currentRoomId)?.find(p => p.userId === newHostId);
      const transferAction = {
        room_id: state.currentRoomId,
        user_id: state.currentUserId,
        action_type: 'host_transferred',
        details: { oldHostId: state.currentUserId, oldHostUserName: state.currentUserName, newHostId: newHostId, newHostUserName: newHostDetails?.userName || newHostId }
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
        logToSupabase({ type: 'LOGGING_ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Failed to log host_transferred to user_actions_log.', data: { error: { message: transferLogError.message, code: transferLogError.code, details: transferLogError.details, hint: transferLogError.hint, stack: transferLogError.stack } } });
      }
    } catch (error) {
      console.error('Exception logging host_transferred action:', error);
      logToSupabase({ type: 'EXCEPTION_LOGGING_ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Exception when logging host_transferred to user_actions_log.', data: { error: { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } } });
    }
    if (callback) callback({ success: true });
  } else {
    if (callback) callback({ success: false, error: result.message });
  }
};
