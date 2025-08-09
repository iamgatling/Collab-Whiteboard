require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const { supabase: supabaseClient } = require('./supabase');
const { logToSupabase } = require('./logger');
const { handleSocketConnection, eventNames } = require('./events.js');
const roomManager = require('./roomManager');

console.log('Allowed frontend URL:', process.env.FRONTEND_URL);
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const frontendUrl = (process.env.FRONTEND_URL || '*').replace(/\/$/, '');

const io = new Server(server, { 
  cors: { 
    origin: frontendUrl,
    methods: ['GET', 'POST'],
    credentials: true
  } 
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_KEY must be provided in .env');
  process.exit(1);
}

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Backend Landing Page</title>
      <style>
        body {
          background: #282c34;
          color: #61dafb;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          text-align: center;
        }
        h1 {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }
        p {
          font-size: 1.5rem;
          color: #21d07a;
        }
        small {
          margin-top: 2rem;
          color: #888;
        }
      </style>
    </head>
    <body>
      <h1>Backend is running!</h1>
      <p>Socket.IO + Supabase </p>
      <p>ACTIVE🤩</p>
      <small>All systems green.</small>
    </body>
    </html>
  `);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    
    if (error) throw error;
    
    if (data) {
      res.json({ 
        roomId: data.id,
        canvasData: data.canvasData,
        textData: data.textData,
        updatedAt: data.updated_at,
        usersCount: roomManager.getRoomParticipants(roomId)?.length || 0
      });
    } else {
      res.status(404).json({ error: 'Room not found' });
    }
  } catch (err) {
    console.error('Error fetching room:', err);
    logToSupabase({
      type: 'ERROR',
      roomId: req.params.roomId,
      message: `Error fetching room data for room ${req.params.roomId}. Error: ${err.message}`,
      data: { error: err.stack, function: 'getRoomApi' }
    });
    res.status(500).json({ error: 'Failed to fetch room data' });
  }
});

// TODO: Re-evaluate this cleanup logic. roomManager also has cleanup.

const ROOM_INACTIVITY_THRESHOLD = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL = 60 * 60 * 1000;

// might need to be adapted if roomManager is the sole source of truth for room activity and participant counts. 
function cleanupInactiveSupabaseRooms() {
  console.log('Running cleanup for inactive Supabase rooms...');
  // This logic needs re-evaluation.
}

function startCleanupInterval() {
  // Temporarily commenting out to avoid errors
  console.log('Supabase cleanup interval not started pending review of roomManager integration.');
}

io.on('connection', (socket) => {
  handleSocketConnection(socket, io, roomManager, supabaseClient, logToSupabase);
});

server.listen(process.env.PORT || 3001, () => {
  console.log(`Backend running on port ${process.env.PORT || 3001}`);
  console.log(`Connected to Supabase at ${supabaseUrl}`);
  logToSupabase({
    type: 'SYSTEM_EVENT',
    message: `Server started on port ${process.env.PORT || 3001}. Connected to Supabase at ${supabaseUrl}.`
  });
  startCleanupInterval();
}).on('error', (err) => {
  console.error('Failed to start server:', err);
});