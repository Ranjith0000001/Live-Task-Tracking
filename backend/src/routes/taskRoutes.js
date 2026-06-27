import express from "express";
const router = express.Router();
import { getAllTasks, createTask, reorderTasks, updateTask, deleteTask } from "../controllers/taskController.js";

router.get("/", getAllTasks);
router.post("/", createTask);
router.put("/reorder", reorderTasks);   
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

export default router;