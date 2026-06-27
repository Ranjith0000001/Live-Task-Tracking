import { useState, useEffect } from "react";
import axios from "axios";
import {
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  Box,
  Grid,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Avatar,
  Badge,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Sync as SyncIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  Schedule as ScheduleIcon,
} from "@mui/icons-material";

import { useWebSocket } from "./hooks/useWebSocket"; // ADD THIS

const API = "http://localhost:5000/api/tasks";

const COLUMNS = [
  { id: "todo", title: "To Do", color: "#ff9800" },
  { id: "inprogress", title: "In Progress", color: "#2196f3" },
  { id: "done", title: "Done", color: "#4caf50" },
];

function App() {
  // Use WebSocket hook
  const {
    isConnected,
    wsStatus,
    reconnectIn,
    boardState: wsBoardState,
    setBoardState: setWsBoardState,
    connectedUsers = []
  } = useWebSocket();

  // Local state
  const [tasks, setTasks] = useState({ todo: [], inprogress: [], done: [] });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [dragTask, setDragTask] = useState(null);
  // { columnId, index } — tracks which slot the dragged card is hovering over
  const [dragOverInfo, setDragOverInfo] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newEffortHrs, setNewEffortHrs] = useState("");

  // Sync WebSocket board state with local state (after initial load, this keeps tasks in sync)
  useEffect(() => {
    if (Object.keys(wsBoardState).length > 0) {
      setTasks(wsBoardState);
    }
  }, [wsBoardState]);

  // Fetch tasks from API (initial load)
  const fetchTasks = async () => {
    try {
      const { data } = await axios.get(API);
      const grouped = { todo: [], inprogress: [], done: [] };
      data.forEach((task) => {
        if (grouped[task.status]) {
          grouped[task.status].push(task);
        }
      });
      setTasks(grouped);
      setWsBoardState(grouped); // Update WebSocket state
    } catch (err) {
      console.error("Error fetching tasks:", err);
      showSnackbar("Error fetching tasks", "error");
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Show notification
  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  // Create task
  const handleAddTask = async () => {
    if (!newTitle.trim()) return;
    try {
      await axios.post(API, {
        title: newTitle.trim(),
        assignee: newAssignee.trim(),
        deadline: newDeadline,
        effortHrs: parseFloat(newEffortHrs),
      });
      setNewTitle("");
      setNewAssignee("");
      setNewDeadline("");
      setNewEffortHrs("");
      setAddDialogOpen(false);
      showSnackbar("Task created successfully!");
    } catch (err) {
      console.error("Error creating task:", err);
      showSnackbar("Error creating task", "error");
    }
  };

  // Delete task
  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    try {
      await axios.delete(`${API}/${selectedTask.id}`);
      setAnchorEl(null);
      setSelectedTask(null);
      showSnackbar("Task deleted!");
    } catch (err) {
      console.error("Error deleting task:", err);
      showSnackbar("Error deleting task", "error");
    }
  };

  // Move task (status update)
  const handleMoveTask = async (direction) => {
    if (!selectedTask) return;
    const columnOrder = ["todo", "inprogress", "done"];
    const currentIndex = columnOrder.indexOf(selectedTask.status);
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= columnOrder.length) return;

    try {
      await axios.put(`${API}/${selectedTask.id}`, {
        status: columnOrder[targetIndex],
      });
      setAnchorEl(null);
      setSelectedTask(null);
      showSnackbar(`Task moved to ${COLUMNS[targetIndex].title}`);
    } catch (err) {
      console.error("Error moving task:", err);
      showSnackbar("Error moving task", "error");
    }
  };

  // Edit task
  const handleOpenEdit = () => {
    if (!selectedTask) return;
    setEditText(selectedTask.title);
    setEditDialogOpen(true);
    setAnchorEl(null);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || !selectedTask) return;
    try {
      await axios.put(`${API}/${selectedTask.id}`, {
        title: editText.trim(),
      });
      setEditDialogOpen(false);
      setSelectedTask(null);
      showSnackbar("Task updated!");
    } catch (err) {
      console.error("Error updating task:", err);
      showSnackbar("Error updating task", "error");
    }
  };

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDragStart = (task) => {
    setDragTask(task);
  };

  // Called on the column container — for inter-column drops only
  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Called on each task card during hover — tracks insertion index
  const handleCardDragEnter = (e, columnId, index) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverInfo({ columnId, index });
  };

  const handleCardDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    if (!dragTask) { setDragTask(null); setDragOverInfo(null); return; }

    const isSameColumn = dragTask.status === targetStatus;

    if (isSameColumn) {
      // ── Intra-column reorder ──
      const column = tasks[targetStatus];
      const fromIndex = column.findIndex(t => t.id === dragTask.id);
      const toIndex   = dragOverInfo?.columnId === targetStatus ? dragOverInfo.index : column.length - 1;

      if (fromIndex === -1 || fromIndex === toIndex) {
        setDragTask(null); setDragOverInfo(null); return;
      }

      // Optimistic UI update
      const reordered = [...column];
      const [moved] = reordered.splice(fromIndex, 1);
      const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
      reordered.splice(insertAt, 0, moved);

      setTasks(prev => ({ ...prev, [targetStatus]: reordered }));
      setDragTask(null); setDragOverInfo(null);

      try {
        await axios.put(`${API}/reorder`, {
          columnId: targetStatus,
          orderedIds: reordered.map(t => t.id),
        });
      } catch (err) {
        console.error("Error reordering:", err);
        showSnackbar("Error saving order", "error");
        // Revert on failure
        setTasks(prev => ({ ...prev, [targetStatus]: column }));
      }
    } else {
      // ── Inter-column move (existing behaviour unchanged) ──
      setDragTask(null); setDragOverInfo(null);
      try {
        await axios.put(`${API}/${dragTask.id}`, { status: targetStatus });
      } catch (err) {
        console.error("Error moving task:", err);
        showSnackbar("Error moving task", "error");
      }
    }
  };

  const handleDragEnd = () => {
    setDragTask(null);
    setDragOverInfo(null);
  };



  // Menu handlers
  const handleMenuOpen = (event, task) => {
    setAnchorEl(event.currentTarget);
    setSelectedTask(task);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTask(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleAddTask();
  };

  // 3-state status config
  const statusConfig = {
    connected:    { label: 'Live',         color: '#2e7d32', bg: '#e8f5e9', dot: '#4caf50', icon: WifiIcon },
    reconnecting: { label: reconnectIn > 0 ? `Reconnecting ${reconnectIn}s` : 'Reconnecting…', color: '#7c4f00', bg: '#fff8e1', dot: '#ff9800', icon: SyncIcon },
    connecting:   { label: 'Connecting…',  color: '#1565c0', bg: '#e3f2fd', dot: '#2196f3', icon: SyncIcon },
  };
  const sc = statusConfig[wsStatus] || statusConfig.connecting;

  return (
    <Box sx={{ bgcolor: "#f5f5f5", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="lg">
        {/* Header with Connection Status */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 700, color: "#333" }}
          >
            Task Board
          </Typography>
          
          {/* Connection Status Badge */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>

            {/* 3-state animated pill */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.25,
                py: 0.4,
                borderRadius: 99,
                bgcolor: sc.bg,
                border: `1px solid ${sc.dot}44`,
                transition: 'all 0.4s ease',
              }}
            >
              {/* Animated dot */}
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: sc.dot,
                  flexShrink: 0,
                  ...(wsStatus !== 'connected' && {
                    animation: 'wsPulse 1.2s ease-in-out infinite',
                    '@keyframes wsPulse': {
                      '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                      '50%':       { opacity: 0.35, transform: 'scale(0.75)' },
                    },
                  }),
                }}
              />
              {/* Spinning icon while not connected */}
              {wsStatus !== 'connected' && (
                <SyncIcon
                  sx={{
                    fontSize: 13,
                    color: sc.dot,
                    animation: 'wsSpin 1s linear infinite',
                    '@keyframes wsSpin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
                  }}
                />
              )}
              <Typography
                variant="caption"
                sx={{ color: sc.color, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap' }}
              >
                {sc.label}
              </Typography>
            </Box>

            {/* Connected users avatars — unchanged */}
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {connectedUsers.map((user) => (
                <Tooltip key={user.id} title={user.name} arrow>
                  <Avatar
                    sx={{
                      width: 28,
                      height: 28,
                      fontSize: 12,
                      bgcolor: user.color,
                      border: "2px solid #fff",
                      ml: -1,
                    }}
                  >
                    {user.name?.[0] || '?'}
                  </Avatar>
                </Tooltip>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Add Task Button */}
        <Box sx={{ mb: 3, display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
            disabled={!isConnected}
            sx={{ borderRadius: 2, px: 3, py: 1 }}
          >
            Add Task
          </Button>
        </Box>

        {/* Realtime Status Alert */}
        {wsStatus === 'reconnecting' && (
          <Alert
            severity="warning"
            icon={<SyncIcon sx={{ animation: 'wsSpin 1s linear infinite', '@keyframes wsSpin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />}
            sx={{ mb: 2 }}
          >
            Connection lost — board data preserved.{' '}
            {reconnectIn > 0
              ? `Reconnecting in ${reconnectIn}s…`
              : 'Reconnecting now…'}
          </Alert>
        )}
        {wsStatus === 'connecting' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Connecting to live server…
          </Alert>
        )}

        {/* Kanban Columns */}
        <Grid container spacing={2}>
          {COLUMNS.map((column) => (
            <Grid item xs={12} md={4} key={column.id}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: "1px solid #e0e0e0",
                  minHeight: 300,
                  display: "flex",
                  flexDirection: "column",
                  bgcolor:
                    dragTask && dragTask.status !== column.id
                      ? "#f0f8ff"
                      : "transparent",
                  transition: "background-color 0.2s",
                }}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 2,
                    pb: 2,
                    borderBottom: `3px solid ${column.color}`,
                  }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      bgcolor: column.color,
                    }}
                  />
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, flex: 1 }}
                  >
                    {column.title}
                  </Typography>
                  <Chip
                    label={tasks[column.id]?.length || 0}
                    size="small"
                    sx={{
                      bgcolor: column.color,
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  />
                </Box>

                <Box sx={{ flex: 1 }}>
                  {tasks[column.id]?.length === 0 ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      align="center"
                      sx={{ mt: 4 }}
                    >
                      No tasks
                    </Typography>
                  ) : (
                    tasks[column.id]?.map((task, index) => (
                      <Box key={task.id}>
                        {/* Drop-indicator line — shown above this slot when dragging over it */}
                        {dragTask &&
                          dragTask.id !== task.id &&
                          dragOverInfo?.columnId === column.id &&
                          dragOverInfo?.index === index && (
                            <Box
                              sx={{
                                height: 3,
                                borderRadius: 99,
                                bgcolor: column.color,
                                mx: 0.5,
                                mb: 0.75,
                                opacity: 0.8,
                                transition: 'opacity 0.15s',
                              }}
                            />
                          )}
                        <Paper
                          elevation={1}
                          draggable={isConnected}
                          onDragStart={() => handleDragStart(task)}
                          onDragEnd={handleDragEnd}
                          onDragEnter={(e) => handleCardDragEnter(e, column.id, index)}
                          onDragOver={handleCardDragOver}
                          sx={{
                            p: 1.5,
                            mb: 1.5,
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            cursor: isConnected ? "grab" : "default",
                            transition: "all 0.2s",
                            "&:hover": {
                              boxShadow: isConnected ? 3 : 1,
                              transform: isConnected ? "translateY(-1px)" : "none",
                            },
                            opacity: dragTask?.id === task.id ? 0.4 : 1,
                            borderLeft: `4px solid ${column.color}`,
                          }}
                        >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 500,
                              wordBreak: "break-word",
                              mb: 0.5,
                            }}
                          >
                            {task.title}
                          </Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
                            {task.assignee && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <PersonIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                                <Typography variant="caption" color="text.secondary">
                                  {task.assignee}
                                </Typography>
                              </Box>
                            )}
                            {task.deadline && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <CalendarIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(task.deadline).toLocaleDateString()}
                                </Typography>
                              </Box>
                            )}
                            {task.effortHrs && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <TimeIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                                <Typography variant="caption" color="text.secondary">
                                  {task.effortHrs}h
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, task)}
                          disabled={!isConnected}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                        </Paper>
                      </Box>
                    ))
                  )}
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Task Context Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleOpenEdit}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
          {selectedTask && selectedTask.status !== "todo" && (
            <MenuItem onClick={() => handleMoveTask(-1)}>
              ← Move to{" "}
              {COLUMNS[
                COLUMNS.findIndex(
                  (c) => c.id === selectedTask.status
                ) - 1
              ]?.title || "Previous"}
            </MenuItem>
          )}
          {selectedTask && selectedTask.status !== "done" && (
            <MenuItem onClick={() => handleMoveTask(1)}>
              Move to{" "}
              {COLUMNS[
                COLUMNS.findIndex(
                  (c) => c.id === selectedTask.status
                ) + 1
              ]?.title || "Next"}{" "}
              →
            </MenuItem>
          )}
          <MenuItem
            onClick={handleDeleteTask}
            sx={{ color: "error.main" }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        </Menu>

        {/* Add Task Dialog */}
        <Dialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Create New Task</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              margin="dense"
              label="Title *"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              variant="outlined"
            />
            <TextField
              fullWidth
              margin="dense"
              label="Assignee *"
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              InputProps={{
                startAdornment: (
                  <PersonIcon sx={{ mr: 1, color: "text.secondary" }} />
                ),
              }}
              variant="outlined"
            />
            <TextField
              fullWidth
              margin="dense"
              label="Deadline *"
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              InputProps={{
                startAdornment: (
                  <CalendarIcon sx={{ mr: 1, color: "text.secondary" }} />
                ),
              }}
              InputLabelProps={{ shrink: true }}
              variant="outlined"
            />
            <TextField
              fullWidth
              margin="dense"
              label="Effort Hours *"
              type="number"
              value={newEffortHrs}
              onChange={(e) => setNewEffortHrs(e.target.value)}
              InputProps={{
                startAdornment: (
                  <TimeIcon sx={{ mr: 1, color: "text.secondary" }} />
                ),
              }}
              variant="outlined"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddTask}
              variant="contained"
              disabled={!newTitle.trim() || !newAssignee.trim() || !newDeadline || !newEffortHrs}
            >
              Create Task
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Task Dialog */}
        <Dialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Edit Task</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              margin="dense"
              label="Task Title"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") handleSaveEdit();
              }}
              variant="outlined"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              variant="contained"
              disabled={!editText.trim()}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <Alert 
            onClose={() => setSnackbar({ ...snackbar, open: false })} 
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}

export default App;