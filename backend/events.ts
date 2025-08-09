import { Server, Socket } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';
import { RoomManager } from './roomManager';
import { logToSupabase } from './logger';
import joinRoomHandler from './handlers/joinRoom';
import sendMessageHandler from './handlers/sendMessage';
import getRoomParticipantsHandler from './handlers/getRoomParticipants';
import drawHandler from './handlers/draw';
import textUpdateHandler from './handlers/textUpdate';
import periodicSaveHandler from './handlers/periodicSave';
import clearCanvasHandler from './handlers/clearCanvas';
import disconnectHandler from './handlers/disconnect';
import toggleRoomLockHandler from './handlers/toggleRoomLock';
import transferHostHandler from './handlers/transferHost';
import kickUserHandler from './handlers/kickUser';
import endRoomSessionHandler from './handlers/endRoomSession';
import brushUpdateHandler from './handlers/brushUpdate';

export const eventNames = {
  DRAW: 'drawing',
  CLEAR_CANVAS: 'clear-canvas',
  JOIN_ROOM: 'join-room',
  TEXT_UPDATE: 'text-update',
  PERIODIC_SAVE: 'periodic-save',
  USERS_COUNT: 'users-count',
  LOAD_INITIAL: 'load-initial',
  SAVE_CONFIRMED: 'save-confirmed',
  SAVE_FAILED: 'save-failed',
  SEND_MESSAGE: 'send-message',
  RECEIVE_MESSAGE: 'receive-message',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  GET_ROOM_PARTICIPANTS: 'get-room-participants',
  ROOM_PARTICIPANTS: 'room-participants',
  PERMISSION_DENIED: 'permission-denied',
  TOGGLE_ROOM_LOCK: 'toggle-room-lock',
  ROOM_LOCK_STATUS_CHANGED: 'room-lock-status-changed',
  TRANSFER_HOST: 'transfer-host',
  HOST_CHANGED: 'host-changed',
  KICK_USER: 'kick-user',
  USER_KICKED: 'user-kicked',
  YOU_WERE_KICKED: 'you-were-kicked',
  END_ROOM_SESSION: 'end-room-session',
  ROOM_SESSION_ENDED: 'room-session-ended',
  ROOM_JOINED_SUCCESSFULLY: 'room-joined-successfully',
  BRUSH_UPDATE: 'brush-update',
  LOAD_CANVAS_HISTORY: 'load_canvas_history',
};

interface State {
  currentRoomId: string | null;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: 'host' | 'editor' | 'viewer';
}

export function handleSocketConnection(socket: Socket, io: Server, roomManager: RoomManager, supabase: SupabaseClient, logToSupabase: typeof logToSupabase) {
  const state: State = {
    currentRoomId: null,
    currentUserId: socket.id,
    currentUserName: `User_${socket.id.substring(0, 5)}`,
    currentUserRole: 'viewer',
  };

  console.log(`[SERVER] New socket trying to connect, ID: ${socket.id}, Query: ${JSON.stringify(socket.handshake.query)}`);
  logToSupabase({
    type: 'USER_CONNECTED_SOCKET',
    userId: state.currentUserId,
    message: `User socket ${state.currentUserId} connected to server.`
  });

  socket.on(eventNames.JOIN_ROOM, joinRoomHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on(eventNames.SEND_MESSAGE, sendMessageHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on(eventNames.GET_ROOM_PARTICIPANTS, getRoomParticipantsHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on(eventNames.DRAW, drawHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on(eventNames.TEXT_UPDATE, textUpdateHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on(eventNames.PERIODIC_SAVE, periodicSaveHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on(eventNames.CLEAR_CANVAS, clearCanvasHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on('disconnect', disconnectHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on(eventNames.TOGGLE_ROOM_LOCK, toggleRoomLockHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on(eventNames.TRANSFER_HOST, transferHostHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on(eventNames.KICK_USER, kickUserHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on(eventNames.END_ROOM_SESSION, endRoomSessionHandler(io, socket, roomManager, supabase, logToSupabase, state));
  socket.on(eventNames.BRUSH_UPDATE, brushUpdateHandler(io, socket, roomManager, supabase, logToSupabase, state));
}