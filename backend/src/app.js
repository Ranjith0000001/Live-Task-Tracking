import express from "express";
import cors from "cors";
import { setupWebSocket } from "./websocket.js"; 
import http from "http";
import taskRoutes from "./routes/taskRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/tasks", taskRoutes);

app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

const server = http.createServer(app); 
setupWebSocket(server);

export { app, server };