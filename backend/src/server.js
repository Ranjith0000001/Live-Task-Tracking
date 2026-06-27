import { app, server } from "./app.js"; 
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => { 
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws`);
});