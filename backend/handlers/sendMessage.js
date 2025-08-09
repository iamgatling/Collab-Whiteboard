const { eventNames } = require('../events');

module.exports = (io, socket, roomManager, supabase, logToSupabase, state) => (data) => {
  if (!state.currentRoomId) {
    console.error(`User ${state.currentUserId} tried to send message without being in a room.`);
    return;
  }
  const { text } = data;
  const messageData = {
    text,
    senderName: state.currentUserName,
    senderId: state.currentUserId,
    timestamp: new Date().toISOString()
  };
  io.to(state.currentRoomId).emit(eventNames.RECEIVE_MESSAGE, messageData);
  roomManager.updateRoomActivity(state.currentRoomId);

  try {
    const chatMessage = {
      room_id: state.currentRoomId,
      user_id: state.currentUserId,
      user_name: state.currentUserName,
      message_text: text,
    };
    async function insertChatMessage(chatMessage) {
      const { error: chatError } = await supabase.from('chat_messages').insert([chatMessage]);
      if (chatError) {
        console.error("Insert failed:", chatError);
        logToSupabase({
          type: 'ERROR',
          roomId: state.currentRoomId,
          userId: state.currentUserId,
          message: 'Failed to log chat message to chat_messages.',
          data: {
            error: {
              message: chatError.message,
              code: chatError.code,
              details: chatError.details,
              hint: chatError.hint,
              stack: chatError.stack
            }
          }
        });
      }
    }
    insertChatMessage(chatMessage);
  } catch (error) {
    console.error('Exception logging chat message:', error);
    logToSupabase({
      type: 'ERROR',
      roomId: state.currentRoomId,
      userId: state.currentUserId,
      message: 'Exception when logging chat message.',
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
};
