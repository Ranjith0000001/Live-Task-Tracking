# Live Task Tracking - Kanban Board

A real-time collaborative Kanban Task Board built with a modern web stack. It supports adding, updating, deleting, and reordering tasks, with instant synchronization across all active users.

---

## 🚀 Core Features & Architectural Decisions

- **Backend**: Built with Node.js, Express, WebSockets (`ws`), and Prisma ORM connecting to a PostgreSQL database.
- **Frontend**: Built with React, Vite, and Material-UI (MUI) for a clean, premium, and responsive visual layout.
- **Real-time Sync**: Utilizes a persistent WebSocket server to immediately broadcast changes (additions, deletions, edits, reordering, and active users online) to all clients.

---

## 🎁 Bonus Features Status

### Done:
1. **Presence Tracking**: 
   - Tracks active collaborative sessions.
   - Automatically assigns a random username (e.g., "User 1234") and a unique avatar color to each connected WebSocket client.
   - Displays a live list of active online users at the top of the interface.
2. **Drag & Drop Ordering**:
   - Users can drag tasks within a column or between columns.
   - Drags update the `position` sorting index in PostgreSQL to persist board arrangements correctly.
   - Reordering triggers a database update and broadcasts the new state instantly via WebSockets to keep all boards visually synchronized.

### Skipped:
1. **Conflict Handling**:
   - Detailed CRDT (Conflict-free Replicated Data Type) / OT (Operational Transformation) handling was skipped.
   - The application relies on database order persistence and last-write-wins updates broadcasted across active WebSocket connections.

---

## 🛠️ Setup & Running Locally

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: A running local or cloud instance (e.g., Neon)

### 1. Environment Variables Configuration
Configure environment variables for both the backend and frontend:

**Backend Setup:**
Create a `.env` file in the `backend/` directory:
```bash
# In backend/ directory
cp .env.example .env
```
Inside the `backend/.env` file:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/databasename?schema=public"
PORT=5000
```

**Frontend Setup:**
Create a `.env` file in the `frontend/` directory to configure connection endpoints:
```bash
# In frontend/ directory
cp .env.example .env
```
Inside the `frontend/.env` file:
```env
VITE_API_URL="http://localhost:5000/api/tasks"
VITE_WS_URL="ws://localhost:5000/ws"
```


### 2. Database Migrations
Run the migrations to setup the tables in your PostgreSQL database:
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
cd ..
```

### 3. Install & Run in a Single Command
From the root directory, install all dependencies for both frontend and backend and start the application:

```bash
# Install dependencies for both frontend and backend
npm run install:all

# Run both development servers concurrently
npm run dev
```

The application will launch:
- **Frontend**: Runs on [http://localhost:5173/](http://localhost:5173/) (or next available port)
- **Backend**: Runs on [http://localhost:5000/](http://localhost:5000/)

---
