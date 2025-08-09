import { Server, Socket } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';
import { RoomManager } from '../roomManager';
import { LogToSupabaseFn } from '../logger';
import { eventNames } from '../events';
import * as utils from '../utils';

interface State {
  currentRoomId?: string;
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
) => async () => {
  try {
    if (!state.currentRoomId) return;

    const permCheck = utils.canUserPerformEditAction(state.currentUserId, state.currentUserRole, state.currentRoomId, roomManager);
    if (!permCheck.allowed) {
      socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.CLEAR_CANVAS, message: permCheck.message, code: permCheck.code });
      logToSupabase({ type: eventNames.PERMISSION_DENIED, roomId: state.currentRoomId, userId: state.currentUserId, message: `User ${state.currentUserName} denied action ${eventNames.CLEAR_CANVAS}: ${permCheck.message}`, data: { action: eventNames.CLEAR_CANVAS, code: permCheck.code } });
      return;
    }
    roomManager.updateRoomActivity(state.currentRoomId);
    socket.to(state.currentRoomId).emit(eventNames.CLEAR_CANVAS);

    try {
      const clearAction = {
        room_id: state.currentRoomId,
        user_id: state.currentUserId,
        action_type: 'clear_canvas',
        data: {},
      };
      const { error: clearError } = await supabase.from('canvas_draw_actions').insert([clearAction]);
      if (clearError) {
        console.error('Supabase error logging clear canvas action:', clearError);
        logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Failed to log clear_canvas action.', data: { error: { message: clearError.message, code: clearError.code, details: clearError.details, hint: clearError.hint, stack: clearError.stack } } });
      }
    } catch (error) {
      console.error('Exception logging clear canvas action:', error);
      logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Exception when logging clear_canvas action.', data: { error: { message: (error as Error).message, stack: (error as Error).stack } } });
    }

    try {
      const timestamp = new Date().toISOString();
      const { error: roomUpdateError } = await supabase.from('rooms').update({ canvasData: null, updated_at: timestamp }).eq('id', state.currentRoomId);
      if (roomUpdateError) {
        console.error('Supabase error updating room canvasdata for clear:', roomUpdateError);
        logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Failed to update room canvasdata for clear.', data: { error: { message: roomUpdateError.message, code: roomUpdateError.code, details: roomUpdateError.details, hint: roomUpdateError.hint, stack: roomUpdateError.stack } } });
      }
    } catch (error) {
      console.error('Exception updating room canvasdata for clear:', error);
      logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Exception when updating room canvasdata for clear.', data: { error: { message: (error as Error).message, stack: (error as Error).stack } } });
    }

  } catch (err) {
    console.error('Error in CLEAR_CANVAS event handler:', err);
    logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: `Error in CLEAR_CANVAS event: ${(err as Error).message}`, data: { error: { message: (err as Error).message, stack: (err as Error).stack }, function: 'clearCanvasHandler' } });
  }
};
