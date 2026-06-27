const taskService = require("../services/taskService");
const { broadcastUpdate, updateCurrentState } = require("../websocket");
const { groupTasksByStatus } = require("../utils/taskUtils");

const getAllTasks = async (req, res) => {
    try {
        const tasks = await taskService.getAllTasks();
        const groupedTasks = groupTasksByStatus(tasks);
        updateCurrentState(groupedTasks); 
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createTask = async (req, res) => {
    try {
        const { title, assignee, deadline, effortHrs } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ error: "Title is required" });
        }
        if (!assignee || !assignee.trim()) {
            return res.status(400).json({ error: "Assignee is required" });
        }
        if (!deadline) {
            return res.status(400).json({ error: "Deadline is required" });
        }
        if (effortHrs === undefined || effortHrs === null || isNaN(Number(effortHrs))) {
            return res.status(400).json({ error: "Effort hours is required" });
        }
        const parsedEffort = parseFloat(effortHrs);
        if (parsedEffort < 0) {
            return res.status(400).json({ error: "Effort hours must be positive" });
        }
        const task = await taskService.createTask({ title: title.trim(), assignee: assignee.trim(), deadline, effortHrs: parsedEffort });
        const allTasks = await taskService.getAllTasks();
        const groupedTasks = groupTasksByStatus(allTasks);
        updateCurrentState(groupedTasks);
        const createdTask = {
            ...task,
            deadline: task.deadline ? task.deadline.toISOString() : null,
            effortHrs: Number(task.effortHrs)
        };
        broadcastUpdate({ type: 'TASK_ADDED', payload: { task: createdTask } });
        res.status(201).json(createdTask);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateTask = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { title, status } = req.body;
        if (status && !["todo", "inprogress", "done"].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        const existingTask = await taskService.getTaskById(id);
        if (!existingTask) {
            return res.status(404).json({ error: "Task not found" });
        }
        const oldStatus = existingTask.status;
        const task = await taskService.updateTask(id, { title, status });
        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }
        const allTasks = await taskService.getAllTasks();
        const groupedTasks = groupTasksByStatus(allTasks);
        updateCurrentState(groupedTasks);
        const updatedTask = {
            ...task,
            deadline: task.deadline ? task.deadline.toISOString() : null,
            effortHrs: Number(task.effortHrs)
        };
        broadcastUpdate({
            type: 'TASK_UPDATED',
            payload: {
                task: updatedTask,
                oldStatus: oldStatus,
                changes: { title, status }
            }
        });
        res.json(updatedTask);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteTask = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const task = await taskService.deleteTask(id);
        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }
        const allTasks = await taskService.getAllTasks();
        const groupedTasks = groupTasksByStatus(allTasks);
        updateCurrentState(groupedTasks);
        broadcastUpdate({ type: 'TASK_DELETED', payload: { taskId: id, task } });
        res.json({ message: "Task deleted", task });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Reorder tasks within a column and broadcast the new order live
const reorderTasks = async (req, res) => {
    try {
        const { columnId, orderedIds } = req.body;
        if (!columnId || !Array.isArray(orderedIds)) {
            return res.status(400).json({ error: "columnId and orderedIds[] are required" });
        }
        if (!['todo', 'inprogress', 'done'].includes(columnId)) {
            return res.status(400).json({ error: "Invalid columnId" });
        }

        const updatedTasks = await taskService.reorderTasks(orderedIds);

        // Refresh board state cache
        const allTasks = await taskService.getAllTasks();
        const groupedTasks = groupTasksByStatus(allTasks);
        updateCurrentState(groupedTasks);

        // Broadcast new column order to all connected clients
        broadcastUpdate({
            type: 'TASK_REORDERED',
            payload: { columnId, orderedIds },
        });

        res.json({ columnId, tasks: updatedTasks });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { getAllTasks, createTask, updateTask, deleteTask, reorderTasks };
