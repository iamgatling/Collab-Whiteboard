import { Server, Socket } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';
import { RoomManager } from '../roomManager';
import { logToSupabase } from '../logger';
import { eventNames } from '../events';
import * as utils from '../utils';

interface State {
  currentRoomId: string | null;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: 'host' | 'editor' | 'viewer';
}

export default (io: Server, socket: Socket, roomManager: RoomManager, supabase: SupabaseClient, logToSupabase: typeof logToSupabase, state: State) => (data: any, callback: (response: { success: boolean, error?: string }) => void) => {
  if (!state.currentRoomId) {
    if (callback) callback({ success: false, error: 'Not in a room.' });
    return;
  }
  // Use utility to check for host
  if (!utils.isUserHost(state.currentUserId, state.currentRoomId, roomManager)) {
    socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.END_ROOM_SESSION, message: 'Only the host can end the session.' });
    if (callback) callback({ success: false, error: 'Permission denied.' });
    return;
  }
  io.to(state.currentRoomId).emit(eventNames.ROOM_SESSION_ENDED, { roomId: state.currentRoomId });
  const socketsInRoom = io.sockets.adapter.rooms.get(state.currentRoomId);
  if (socketsInRoom) {
    socketsInRoom.forEach(socketId => {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) sock.leave(state.currentRoomId!);
    });
  }
  try {
    const endSessionAction = {
      room_id: state.currentRoomId,
      user_id: state.currentUserId,
      action_type: 'room_ended',
      details: { endedBy: state.currentUserName }
    };
    async function insertendSessionAction(endSessionAction: any) {
      const { error: endLogError } = await supabase.from('user_actions_log')
        .insert([endSessionAction]);
      if (endLogError) {
        console.error("Insert failed:", endLogError);
      }
    }
    insertendSessionAction(endSessionAction);
  } catch (error) {
      console.error('Exception logging room_ended action:', error);
      logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Exception when logging room_ended action.', data: { error: { message: (error as Error).message, stack: (error as Error).stack } } });
  }

  roomManager.removeAllParticipants(state.currentRoomId);

  try {
    const endSessionAction = {
      room_id: state.currentRoomId,
      user_id: state.currentUserId,
      action_type: 'room_ended',
      details: { endedBy: state.currentUserName }
    };
    async function insertendSessionAction(endSessionAction: any) {
      const { error: endLogError } = await supabase.from('user_actions_log')
        .insert([endSessionAction]).select();
      if (endLogError) {
        console.error("Insert failed:", endLogError);
      }
    }
    insertendSessionAction(endSessionAction);
  } catch (error) {
    console.error('Exception logging room_ended action:', error);
    logToSupabase({ type: 'EXCEPTION_LOGGING_ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Exception when logging room_ended to user_actions_log.', data: { error: { message: (error as Error).message, stack: (error as Error).stack } } });
  }
  state.currentRoomId = null;
  if (callback) callback({ success: true });
};
