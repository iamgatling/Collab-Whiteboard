const { eventNames } = require('../events');
const utils = require('../utils');

module.exports = (io, socket, roomManager, supabase, logToSupabase, state) => ({ color, width }) => {
  try {
    if (!state.currentRoomId) {
      console.warn(`User ${state.currentUserId} tried to update brush without being in a room.`);
      return;
    }

    const permCheck = utils.canUserPerformEditAction(state.currentUserId, state.currentUserRole, state.currentRoomId, roomManager);
    if (!permCheck.allowed) {
      socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.BRUSH_UPDATE, message: permCheck.message, code: permCheck.code });
      logToSupabase({
        type: eventNames.PERMISSION_DENIED,
        roomId: state.currentRoomId,
        userId: state.currentUserId,
        message: `User ${state.currentUserName} denied action ${eventNames.BRUSH_UPDATE}: ${permCheck.message}`,
        data: { action: eventNames.BRUSH_UPDATE, code: permCheck.code }
      });
      return;
    }

    roomManager.updateRoomActivity(state.currentRoomId);

    socket.to(state.currentRoomId).emit(eventNames.BRUSH_UPDATE, { userId: state.currentUserId, userName: state.currentUserName, color, width });

    logToSupabase({
      type: 'BRUSH_SETTINGS_UPDATED',
      roomId: state.currentRoomId,
      userId: state.currentUserId,
      message: `User ${state.currentUserName} updated brush settings.`,
      data: { color, width }
    });

  } catch (err) {
    console.error(`Error in ${eventNames.BRUSH_UPDATE} event handler:`, err);
    logToSupabase({
      type: 'ERROR',
      roomId: state.currentRoomId,
      userId: state.currentUserId,
      message: `Error in ${eventNames.BRUSH_UPDATE} event: ${err.message}`,
      data: { error: { message: err.message, code: err.code, details: err.details, hint: err.hint, stack: err.stack }, function: 'brushUpdateHandler' }
    });
  }
};
