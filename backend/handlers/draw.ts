import { Server, Socket } from "socket.io";
import { SupabaseClient } from "@supabase/supabase-js";
import { RoomManager } from "../roomManager";
import { LogToSupabaseFn } from "../logger";
import { eventNames } from "../events";
import * as utils from "../utils";

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
  async (canvasData: any) => {
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
          action: eventNames.DRAW,
          message: permCheck.message,
          code: permCheck.code,
        });
        logToSupabase({
          type: eventNames.PERMISSION_DENIED,
          roomId: state.currentRoomId,
          userId: state.currentUserId,
          message: `User ${state.currentUserName} denied action ${eventNames.DRAW}: ${permCheck.message}`,
          data: { action: eventNames.DRAW, code: permCheck.code },
        });
        return;
      }
      roomManager.updateRoomActivity(state.currentRoomId);
      socket.to(state.currentRoomId).emit(eventNames.DRAW, canvasData);

      try {
        const drawAction = {
          room_id: state.currentRoomId,
          user_id: state.currentUserId,
          action_type: "draw_path",
          data: canvasData,
        };
        const { error: drawError } = await supabase
          .from("canvas_draw_actions")
          .insert([drawAction]);
        if (drawError) {
          console.error("Supabase error logging draw action:", drawError);

          logToSupabase({
            type: "ERROR",
            roomId: state.currentRoomId,
            userId: state.currentUserId,
            message: "Failed to log draw action to canvas_draw_actions.",
            data: {
              error: {
                message: drawError.message,
                code: drawError.code,
                details: drawError.details,
                hint: drawError.hint,
                stack: drawError.stack,
              },
            },
          });
        }
      } catch (error) {
        console.error("Exception logging draw action:", error);
        logToSupabase({
          type: "ERROR",
          roomId: state.currentRoomId,
          userId: state.currentUserId,
          message: "Exception when logging draw action.",
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
          .update({ canvasData, updated_at: timestamp })
          .eq("id", state.currentRoomId);
        if (roomUpdateError) {
          console.error(
            "Supabase error updating room canvasdata snapshot:",
            roomUpdateError
          );
          logToSupabase({
            type: "ERROR",
            roomId: state.currentRoomId,
            userId: state.currentUserId,
            message: "Failed to update room canvasdata snapshot.",
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
        console.error("Exception updating room canvasdata snapshot:", error);
        logToSupabase({
          type: "ERROR",
          roomId: state.currentRoomId,
          userId: state.currentUserId,
          message: "Exception when updating room canvasdata snapshot.",
          data: {
            error: {
              message: (error as Error).message,
              stack: (error as Error).stack,
            },
          },
        });
      }
    } catch (err) {
      console.error("Error in DRAW event handler:", err);
      logToSupabase({
        type: "ERROR",
        roomId: state.currentRoomId,
        userId: state.currentUserId,
        message: `Error in DRAW event: ${(err as Error).message}`,
        data: {
          error: {
            message: (err as Error).message,
            stack: (err as Error).stack,
          },
          function: "drawingHandler",
        },
      });
    }
  };
