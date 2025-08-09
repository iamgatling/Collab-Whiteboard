const utils = require('./utils'); // Import utilities

// Socket.IO events
const DRAW = 'drawing';
const CLEAR_CANVAS = 'clear-canvas';
const JOIN_ROOM = 'join-room';
const TEXT_UPDATE = 'text-update';
const PERIODIC_SAVE = 'periodic-save';
const USERS_COUNT = 'users-count';
const LOAD_INITIAL = 'load-initial';
const SAVE_CONFIRMED = 'save-confirmed';
const SAVE_FAILED = 'save-failed';
const SEND_MESSAGE = 'send-message';
const RECEIVE_MESSAGE = 'receive-message';
const USER_JOINED = 'user-joined';
const USER_LEFT = 'user-left';
const GET_ROOM_PARTICIPANTS = 'get-room-participants';
const ROOM_PARTICIPANTS = 'room-participants';
const PERMISSION_DENIED = 'permission-denied';
const TOGGLE_ROOM_LOCK = 'toggle-room-lock';
const ROOM_LOCK_STATUS_CHANGED = 'room-lock-status-changed';
const TRANSFER_HOST = 'transfer-host';
const HOST_CHANGED = 'host-changed';
const KICK_USER = 'kick-user';
const USER_KICKED = 'user-kicked';
const YOU_WERE_KICKED = 'you-were-kicked';
const END_ROOM_SESSION = 'end-room-session';
const ROOM_SESSION_ENDED = 'room-session-ended';
const ROOM_JOINED_SUCCESSFULLY = 'room-joined-successfully';
const BRUSH_UPDATE = 'brush-update';

const LOAD_CANVAS_HISTORY = 'load_canvas_history';

const eventNames = {
  DRAW, CLEAR_CANVAS, JOIN_ROOM, TEXT_UPDATE, PERIODIC_SAVE, USERS_COUNT,
  LOAD_INITIAL, SAVE_CONFIRMED, SAVE_FAILED, SEND_MESSAGE, RECEIVE_MESSAGE,
  USER_JOINED, USER_LEFT, GET_ROOM_PARTICIPANTS, ROOM_PARTICIPANTS,
  PERMISSION_DENIED, TOGGLE_ROOM_LOCK, ROOM_LOCK_STATUS_CHANGED,
  TRANSFER_HOST, HOST_CHANGED, KICK_USER, USER_KICKED, YOU_WERE_KICKED,
  END_ROOM_SESSION, ROOM_SESSION_ENDED, LOAD_CANVAS_HISTORY, ROOM_JOINED_SUCCESSFULLY,
  BRUSH_UPDATE,
};

const joinRoomHandler = require('./handlers/joinRoom');
const sendMessageHandler = require('./handlers/sendMessage');
const getRoomParticipantsHandler = require('./handlers/getRoomParticipants');
const drawHandler = require('./handlers/draw');
const textUpdateHandler = require('./handlers/textUpdate');
const periodicSaveHandler = require('./handlers/periodicSave');
const clearCanvasHandler = require('./handlers/clearCanvas');
const disconnectHandler = require('./handlers/disconnect');
const toggleRoomLockHandler = require('./handlers/toggleRoomLock');
const transferHostHandler = require('./handlers/transferHost');
const kickUserHandler = require('./handlers/kickUser');
const endRoomSessionHandler = require('./handlers/endRoomSession');
const brushUpdateHandler = require('./handlers/brushUpdate');

function handleSocketConnection(socket, io, roomManager, supabase, logToSupabase) {
  const state = {
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

module.exports = {
  handleSocketConnection,
  eventNames,
};