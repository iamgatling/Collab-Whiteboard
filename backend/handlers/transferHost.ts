import { Server, Socket } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';
import { RoomManager } from '../roomManager';
import { logToSupabase as logToSupabaseFn } from '../logger';
import { eventNames } from '../events';
import * as utils from '../utils';

interface State {
  currentRoomId: string | null;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: 'host' | 'editor' | 'viewer';
}

export default (io: Server, socket: Socket, roomManager: RoomManager, supabase: SupabaseClient, logToSupabase: typeof logToSupabaseFn, state: State) => (data: { newHostId: string }, callback: (response: { success: boolean, error?: string }) => void) => {
  const { newHostId } = data;
  if (!state.currentRoomId || !newHostId) {
    if (callback) callback({ success: false, error: 'Missing room or new host ID.' });
    return;
  }

  if (!utils.isUserHost(state.currentUserId, state.currentRoomId, roomManager)) {
    socket.emit(eventNames.PERMISSION_DENIED, { action: eventNames.TRANSFER_HOST, message: 'Only the host can transfer host role.' });
    if (callback) callback({ success: false, error: 'Permission denied.' });
    return;
  }
  const result = roomManager.transferHost(state.currentRoomId, state.currentUserId, newHostId);
  if (result.success) {
    state.currentUserRole = 'editor';
    io.to(state.currentRoomId).emit(eventNames.HOST_CHANGED, { roomId: state.currentRoomId, newHostId: newHostId, oldHostId: state.currentUserId });
    io.to(state.currentRoomId).emit(eventNames.ROOM_PARTICIPANTS, roomManager.getRoomParticipants(state.currentRoomId));
    roomManager.updateRoomActivity(state.currentRoomId);

    // Log to user_actions_log
    try {
      const newHostDetails = roomManager.getRoomParticipants(state.currentRoomId)?.find(p => p.userId === newHostId);
      const transferAction = {
        room_id: state.currentRoomId,
        user_id: state.currentUserId,
        action_type: 'host_transferred',
        details: { oldHostId: state.currentUserId, oldHostUserName: state.currentUserName, newHostId: newHostId, newHostUserName: newHostDetails?.userName || newHostId }
      };
      async function inserttransferAction(transferAction: any) {
        const { error: transferLogError } = await supabase.from('user_actions_log')
          .insert([transferAction]);
        if (transferLogError) {
          console.error("Insert failed:", transferLogError);
        }
      }
      inserttransferAction(transferAction);
    } catch (error) {
      console.error('Exception logging host_transferred action:', error);
      logToSupabase({ type: 'ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Exception when logging host_transferred action.', data: { error: { message: (error as Error).message, stack: (error as Error).stack } } });
    }

    try {
      const newHostDetails = roomManager.getRoomParticipants(state.currentRoomId)?.find(p => p.userId === newHostId);
      const transferAction = {
        room_id: state.currentRoomId,
        user_id: state.currentUserId,
        action_type: 'host_transferred',
        details: { oldHostId: state.currentUserId, oldHostUserName: state.currentUserName, newHostId: newHostId, newHostUserName: newHostDetails?.userName || newHostId }
      };
      async function inserttransferAction(transferAction: any) {
        const { error: transferLogError } = await supabase.from('user_actions_log')
          .insert([transferAction]).select();
        if (transferLogError) {
          console.error("Insert failed:", transferLogError);
        }
      }
      inserttransferAction(transferAction);
    } catch (error) {
      console.error('Exception logging host_transferred action:', error);
      logToSupabase({ type: 'EXCEPTION_LOGGING_ERROR', roomId: state.currentRoomId, userId: state.currentUserId, message: 'Exception when logging host_transferred to user_actions_log.', data: { error: { message: (error as Error).message, stack: (error as Error).stack } } });
    }
    if (callback) callback({ success: true });
  } else {
    if (callback) callback({ success: false, error: result.message });
  }
};
