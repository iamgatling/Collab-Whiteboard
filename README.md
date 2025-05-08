<h1 align="center">📝 Collaborative Whiteboard + Textpad</h1>

<p align="center">
A real-time collaborative whiteboard and shared textpad — <br>
<strong>with persistent history per room!</strong><br><br>
</p>

✨ Features

✅ Real-time collaborative whiteboard
✅ Real-time collaborative textpad
✅ Persistent storage → canvas & text saved automatically
✅ Room-based sessions → each URL gets its own whiteboard
✅ See latest saved state when joining a room
✅ User count tracking per room



🚀 Tech Stack

Layer	Tech	Why

Frontend	React + Fabric.js + Socket.io-client	Flexible UI + drawing + websockets
Backend	Node.js + Express + Socket.io	Simple API + real-time server
Database	Supabase (Postgres)	JSONB + text storage
Styling	Tailwind CSS	Rapid, clean styles


🗂️ Project Structure

/backend
  ├── index.js          ← Express + Socket.io server
  ├── .env              ← Supabase keys
/frontend
  ├── src
      ├── App.jsx       ← Main app entry
      ├── components/
          ├── Toolbar.jsx
          ├── RoomInfo.jsx
  ├── index.css         ← Tailwind + custom styles



🖥️ How It Works

1. User visits /room/abc123


2. Server loads saved canvasData + textData from Supabase for roomId=abc123


3. User draws/types → updates broadcast live via Socket.io


4. Server queues save to Supabase every few seconds


5. Another user joins → sees latest saved canvas + text immediately!




🛠️ Setup Instructions

1️⃣ Clone Repo

git clone https://github.com/iamgatling/collab-whiteboard.git
cd collab-whiteboard


2️⃣ Install Backend Dependencies

cd backend
npm install



3️⃣ Create .env file in /backend

SUPABASE_URL=https://yoururl.supabase.co
SUPABASE_KEY=your-service-role-key
PORT=4000

✅ Use service-role key for database writes.


4️⃣ Install Frontend Dependencies

cd ../frontend
npm install


5️⃣ Run Backend

cd ../backend
node index.js

Server runs on http://localhost:4000


6️⃣ Run Frontend

cd ../frontend
npm start

Frontend runs on http://localhost:3000



🏗️ Database Schema (Supabase)

Create a rooms table with:

Column	Type	Description

id	text	Room ID (primary key)
canvasData	jsonb	Fabric.js canvas JSON
textData	text	Collaborative text
createdAt	timestamptz	Creation timestamp
updatedAt	timestamptz	Last update timestamp


✅ Make id primary key


🌐 Environment Variables

Variable	Description

SUPABASE_URL	Your Supabase project URL
SUPABASE_KEY	Supabase service-role key
PORT	Backend port (default 4000)



📡 Socket.io Events

Event	Direction	Description

join-room	client → server	Join a room & fetch saved data
load-initial	server → client	Send saved canvas + text
drawing	client ↔ server	Broadcast updated canvas JSON
text-update	client ↔ server	Broadcast updated text content
room-users	server → client	Broadcast online user count


📝 User Flow

1. Join Room → fetch saved state → load canvas & text


2. Collaborate → live updates via Socket.io


3. Save State → backend saves JSON + text every few seconds


4. Reconnect later → state is still there!



💥 Demo GIF (Coming Soon)

> Add demo recording here once ready



🤝 Contributing

Pull requests welcome! Open issues or suggestions anytime.



📄 License

MIT License © 2025 Your Name



❤️ Credits

Fabric.js

Supabase

Socket.io

Tailwind CSS



🏁 You're ready to collaborate!

> Open http://localhost:3000/room/yourroomid in 2 tabs → draw & type together!


