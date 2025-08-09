import { Server, Socket } from "socket.io";
import { SupabaseClient } from "@supabase/supabase-js";
import { RoomManager } from "../roomManager";
import { LogToSupabaseFn } from "../logger";
import { eventNames } from "../events";
import * as utils from "../utils";

interface State {
  currentRoomId?: string;
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
  async (textData: any) => {
    try {
      if (!state.currentRoomId) return;

      const permCheck = utils.canUserPerformEditAction(
        state.currentUserId,
        state.currentUserRole,
        state.currentRoomId,
        roomManager
      );
      if (!permCheck.allowed) {
        socket.emit(eventNames.PERMISSION_DENIED, {
          action: eventNames.TEXT_UPDATE,
          message: permCheck.message,
          code: permCheck.code,
        });
        logToSupabase({
          type: eventNames.PERMISSION_DENIED,
          roomId: state.currentRoomId,
          userId: state.currentUserId,
          message: `User ${state.currentUserName} denied action ${eventNames.TEXT_UPDATE}: ${permCheck.message}`,
          data: { action: eventNames.TEXT_UPDATE, code: permCheck.code },
        });
        return;
      }
      roomManager.updateRoomActivity(state.currentRoomId);
      socket.to(state.currentRoomId).emit(eventNames.TEXT_UPDATE, textData);

      try {
        const textAction = {
          room_id: state.currentRoomId,
          user_id: state.currentUserId,
          action_type: "add_text",
          data: textData,
        };
        const { error: textError } = await supabase
          .from("canvas_draw_actions")
          .insert([textAction]);
        if (textError) {
          console.error("Supabase error logging text action:", textError);
          logToSupabase({
            type: "ERROR",
            roomId: state.currentRoomId,
            userId: state.currentUserId,
            message: "Failed to log text action to canvas_draw_actions.",
            data: {
              error: {
                message: textError.message,
                code: textError.code,
                details: textError.details,
                hint: textError.hint,
                stack: textError.stack,
              },
            },
          });
        }
      } catch (error) {
        console.error("Exception logging text action:", error);
        logToSupabase({
          type: "ERROR",
          roomId: state.currentRoomId,
          userId: state.currentUserId,
          message: "Exception when logging text action.",
          data: {
            error: {
              message: (error as Error).message,
              stack: (error as Error).stack,
            },
          },
        });
      }

      try {
        const timestamp = new Date().toISOString();
        const { error: roomUpdateError } = await supabase
          .from("rooms")
          .update({ textData, updated_at: timestamp })
          .eq("id", state.currentRoomId);
        if (roomUpdateError) {
          console.error(
            "Supabase error updating room textdata snapshot:",
            roomUpdateError
          );
          logToSupabase({
            type: "ERROR",
            roomId: state.currentRoomId,
            userId: state.currentUserId,
            message: "Failed to update room textdata snapshot.",
            data: {
              error: {
                message: roomUpdateError.message,
                code: roomUpdateError.code,
                details: roomUpdateError.details,
                hint: roomUpdateError.hint,
                stack: roomUpdateError.stack,
              },
            },
          });
        }
      } catch (error) {
        console.error("Exception updating room textdata snapshot:", error);
        logToSupabase({
          type: "ERROR",
          roomId: state.currentRoomId,
          userId: state.currentUserId,
          message: "Exception when updating room textdata snapshot.",
          data: {
            error: {
              message: (error as Error).message,
              stack: (error as Error).stack,
            },
          },
        });
      }
    } catch (err) {
      console.error("Error in TEXT_UPDATE event handler:", err);
      logToSupabase({
        type: "ERROR",
        roomId: state.currentRoomId,
        userId: state.currentUserId,
        message: `Error in TEXT_UPDATE event: ${(err as Error).message}`,
        data: {
          error: {
            message: (err as Error).message,
            stack: (err as Error).stack,
          },
          function: "textUpdateHandler",
        },
      });
    }
  };
