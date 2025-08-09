const { eventNames } = require('../events');
const utils = require('../utils');

module.exports = (io, socket, roomManager, supabase, logToSupabase, state) => async ({ canvasData, textData }) => {
  try {
    if (!state.currentRoomId) return;

    const permCheck = utils.canUserPerformEditAction(state.currentUserId, state.currentUserRole, state.currentRoomId, roomManager);
    if (!permCheck.allowed) {
      socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.PERIODIC_SAVE, message: permCheck.message, code: permCheck.code });
      logToSupabase({ type: eventNames.PERMISSION_DENIED, roomId: state.currentRoomId, userId: state.currentUserId, message: `User ${state.currentUserName} denied action ${eventNames.PERIODIC_SAVE}: ${permCheck.message}`, data: { action: eventNames.PERIODIC_SAVE, code: permCheck.code } });
      return;
    }
    roomManager.updateRoomActivity(state.currentRoomId);
    const timestamp = new Date().toISOString();
    await supabase.from('rooms').update({ canvasData, textData, updated_at: timestamp }).eq('id', state.currentRoomId)
      .then(({ error }) => {
        if (error) throw error;
        socket.emit(eventNames.SAVE_CONFIRMED, { timestamp });
        logToSupabase({ type: 'DATA_SAVED', roomId: state.currentRoomId, userId: socket.id, message: `Data saved for room ${state.currentRoomId}. Trigger: periodic-save.`, data: { canvasLength: canvasData?.length, textLength: textData?.length } });
      });
  } catch (err) {
    console.error('Error in periodic save:', err);
    logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: socket.id, message: `Error in periodic save for room ${state.currentRoomId}. Error: ${err.message}`, data: { error: { message: err.message, code: err.code, details: err.details, hint: err.hint, stack: err.stack }, function: 'periodicSaveHandler' } });
    socket.emit(eventNames.SAVE_FAILED);
  }
};
