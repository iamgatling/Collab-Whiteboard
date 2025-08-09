import { Server, Socket } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';
import { RoomManager } from '../roomManager';
import { LogToSupabaseFn } from '../logger';
import { eventNames } from '../events';

interface State {
  currentRoomId: string | null;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: 'host' | 'editor' | 'viewer';
}

export default (
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  supabase: SupabaseClient,
  logToSupabase: LogToSupabaseFn, 
  state: State
) =>
  (data: { text: string }) => {
    if (!state.currentRoomId) {
      console.error(
        `User ${state.currentUserId} tried to send message without being in a room.`
      );
      return;
    }
    const { text } = data;
    const messageData = {
      text,
      senderName: state.currentUserName,
      senderId: state.currentUserId,
      timestamp: new Date().toISOString(),
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
      async function insertChatMessage(chatMessage: any) {
        const { error: chatError } = await supabase
          .from("chat_messages")
          .insert([chatMessage]);
        if (chatError) {
          console.error("Insert failed:", chatError);
          logToSupabase({
            type: "ERROR",
            roomId: state.currentRoomId!,
            userId: state.currentUserId,
            message: "Failed to log chat message to chat_messages.",
            data: {
              error: {
                message: chatError.message,
                code: chatError.code,
                details: chatError.details,
                hint: chatError.hint,
              },
            },
          });
        }
      }
      insertChatMessage(chatMessage);
    } catch (error) {
      console.error("Exception logging chat message:", error);
      logToSupabase({
        type: "ERROR",
        roomId: state.currentRoomId!,
        userId: state.currentUserId,
        message: "Exception when logging chat message.",
        data: {
          error: {
            message: (error as Error).message,
            stack: (error as Error).stack,
          },
        },
      });
    }
  };
