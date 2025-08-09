import { Server, Socket } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';
import { RoomManager } from '../roomManager';
import { LogToSupabaseFn } from '../logger';
import { eventNames } from '../events';
import * as utils from '../utils';

interface State {
  currentRoomId?: string ;
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
  ({ color, width }: { color: string; width: number }) => {
    try {
      if (!state.currentRoomId) {
        console.warn(
          `User ${state.currentUserId} tried to update brush without being in a room.`
        );
        return;
      }

      const permCheck = utils.canUserPerformEditAction(
        state.currentUserId,
        state.currentUserRole,
        state.currentRoomId,
        roomManager
      );
      if (!permCheck.allowed) {
        socket.emit(eventNames.PERMISSION_DENIED, {
          action: eventNames.BRUSH_UPDATE,
          message: permCheck.message,
          code: permCheck.code,
        });
        logToSupabase({
          type: eventNames.PERMISSION_DENIED,
          roomId: state.currentRoomId,
          userId: state.currentUserId,
          message: `User ${state.currentUserName} denied action ${eventNames.BRUSH_UPDATE}: ${permCheck.message}`,
          data: { action: eventNames.BRUSH_UPDATE, code: permCheck.code },
        });
        return;
      }

      roomManager.updateRoomActivity(state.currentRoomId);

      socket
        .to(state.currentRoomId)
        .emit(eventNames.BRUSH_UPDATE, {
          userId: state.currentUserId,
          userName: state.currentUserName,
          color,
          width,
        });

      logToSupabase({
        type: "BRUSH_SETTINGS_UPDATED",
        roomId: state.currentRoomId,
        userId: state.currentUserId,
        message: `User ${state.currentUserName} updated brush settings.`,
        data: { color, width },
      });
    } catch (err) {
      console.error(`Error in ${eventNames.BRUSH_UPDATE} event handler:`, err);
      logToSupabase({
        type: "ERROR",
        roomId: state.currentRoomId,
        userId: state.currentUserId,
        message: `Error in ${eventNames.BRUSH_UPDATE} event: ${
          (err as Error).message
        }`,
        data: {
          error: {
            message: (err as Error).message,
            stack: (err as Error).stack,
          },
          function: "brushUpdateHandler",
        },
      });
    }
  };
