const { eventNames } = require('../events');

module.exports = (io, socket, roomManager, supabase, logToSupabase, state) => (data, callback) => {
  const targetRoomId = data.roomId || state.currentRoomId;
  if (!targetRoomId) {
    if (callback) {
      callback({ success: false, error: 'Room ID not provided and user not in a room.' });
    }
    return;
  }
  const participants = roomManager.getRoomParticipants(targetRoomId);
  if (callback) {
    callback({ success: true, participants });
  } else {
    socket.emit(eventNames.ROOM_PARTICIPANTS, participants);
  }
};
