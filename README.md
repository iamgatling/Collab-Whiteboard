<h1 align="center">📝 Collaborative Whiteboard</h1>

<p align="center">
A real-time collaborative whiteboard and shared textpad — <br>
<strong>with persistent history per room!</strong>
</p>

## ✨ Features

✅ Real-time collaborative whiteboard  
✅ Real-time collaborative textpad  
✅ Persistent storage → canvas & text saved automatically  
✅ Room-based sessions → each URL gets its own whiteboard  
✅ See latest saved state when joining a room  
✅ User count tracking per room  

---

## 🚀 Tech Stack

| Layer      | Tech                              | Why                          |
|------------|-----------------------------------|-----------------------------|
| Frontend    | React + Fabric.js + Socket.io-client | Flexible UI + drawing + websockets |
| Backend     | Node.js + Express + Socket.io     | Simple API + real-time server |
| Database    | Supabase (Postgres)               | JSONB + text storage        |
| Styling     | Tailwind CSS                      | Rapid, clean styles         |

---

## 🗂️ Project Structure

```plaintext
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
```
---

## 🖥️ How It Works

1. User visits `/room/abc123`
2. Server loads saved `canvasData` + `textData` from Supabase for `roomId=abc123`
3. User draws/types → updates broadcast live via Socket.io
4. Server queues save to Supabase every few seconds
5. Another user joins → sees latest saved canvas + text immediately!

---

## 🛠️ Setup Instructions

### 1️⃣ Clone Repo

```bash
git clone https://github.com/iamgatling/collab-whiteboard.git
cd collab-whiteboard
```
### 2️⃣ Install Backend Dependencies
```bash
cd backend
npm install
```
### 3️⃣ Create .env file in /backend
```bash
SUPABASE_URL=https://yoururl.supabase.co
SUPABASE_KEY=your-service-role-key
PORT=4000
```
✅ Use service-role key for database writes.

### 4️⃣ Install Frontend Dependencies
```bash
cd ../frontend
npm install
```
### 5️⃣ Run Backend
```bash
cd ../backend
node index.js
```
Server runs on http://localhost:4000

### 6️⃣ Run Frontend
```bash
cd ../frontend
npm start
```
Frontend runs on http://localhost:3000


---

### 🗂️ Database Schema (Supabase)

Table: rooms

| Column     | Type       | Description               |
|------------|------------|-------------------------|
| id         | text       | Room ID (primary key)    |
| canvasData | jsonb      | Fabric.js canvas JSON    |
| textData   | text       | Collaborative text       |
| createdAt  | timestamptz| Creation timestamp       |
| updatedAt  | timestamptz| Last update timestamp    |

✅ Make `id` the primary key.

---

### 🌐 Environment Variables

Variable	Description
| Variable       | Type      | Description                    |
|----------------|-----------|--------------------------------|
| SUPABASE_URL   | text      | Your Supabase project URL      |
| SUPABASE_KEY   | text      | Supabase service-role key      |
| PORT           | integer   | Backend port (default: 4000)   |

✅ Use the service-role key for database writes.

---

### 📡 Socket.io Events

- **join-room**
  - Direction: client → server
  - Description: Join a room & fetch saved data

- **load-initial**
  - Direction: server → client
  - Description: Send saved canvas + text

- **drawing**
  - Direction: client ↔ server
  - Description: Broadcast updated canvas JSON

- **text-update**
  - Direction: client ↔ server
  - Description: Broadcast updated text content

- **room-users**
  - Direction: server → client
  - Description: Broadcast online user count



---

### 📝 User Flow

1. Join Room → fetch saved state → load canvas & text


2. Collaborate → live updates via Socket.io


3. Save State → backend saves JSON + text every few seconds


4. Reconnect later → state is still there!




---

### 💥 Demo

> Coming Soon




---

### 🤝 Contributing

Pull requests are welcome! Open issues or suggestions anytime.


---

### 📄 License

MIT License © 2025 iamgatling.


---

### ❤️ Credits

- [Fabric.js](http://fabricjs.com/)
- [Supabase](https://supabase.com/)
- [Socket.io](https://socket.io/)
- [Tailwind CSS](https://tailwindcss.com/)

---

### 🏁 You're ready to collaborate!

> Open http://localhost:3000/room/yourroomid in 2 tabs → draw & type together!
