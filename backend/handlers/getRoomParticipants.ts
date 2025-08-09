import { Server, Socket } from "socket.io";
import { SupabaseClient } from "@supabase/supabase-js";
import { RoomManager } from "../roomManager";
import { LogToSupabaseFn } from "../logger";
import { eventNames } from "../events";

interface State {
  currentRoomId: string | null;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: "host" | "editor" | "viewer";
}

export default (
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  supabase: SupabaseClient,
  logToSupabase: LogToSupabaseFn, 
  state: State
) =>
  (
    data: { roomId?: string },
    callback: (response: {
      success: boolean;
      error?: string;
      participants?: any[];
    }) => void
  ) => {
    const targetRoomId = data.roomId || state.currentRoomId;
    if (!targetRoomId) {
      if (callback) {
        callback({
          success: false,
          error: "Room ID not provided and user not in a room.",
        });
      }
      return;
    }
    const participants = roomManager.getRoomParticipants(targetRoomId);
    if (callback) {
      callback({ success: true, participants: participants || [] });
    } else {
      socket.emit(eventNames.ROOM_PARTICIPANTS, participants);
    }
  };
