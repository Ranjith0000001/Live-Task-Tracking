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
  useMediaQuery,
  useTheme,
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

import { useWebSocket } from "./hooks/useWebSocket";

const API = "http://localhost:5000/api/tasks";

const COLUMNS = [
  { id: "todo",       title: "To Do",       color: "#f59e0b", gradient: "linear-gradient(135deg,#f59e0b,#f97316)", light: "#fff8ed" },
  { id: "inprogress", title: "In Progress",  color: "#3b82f6", gradient: "linear-gradient(135deg,#3b82f6,#6366f1)", light: "#eff6ff" },
  { id: "done",       title: "Done",         color: "#22c55e", gradient: "linear-gradient(135deg,#22c55e,#10b981)", light: "#f0fdf4" },
];

function App() {
  const theme = useTheme();
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down("sm"));

  const {
    isConnected,
    wsStatus,
    reconnectIn,
    boardState: wsBoardState,
    setBoardState: setWsBoardState,
    connectedUsers = []
  } = useWebSocket();

  const [tasks, setTasks] = useState({ todo: [], inprogress: [], done: [] });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [dragTask, setDragTask] = useState(null);
  const [dragOverInfo, setDragOverInfo] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newEffortHrs, setNewEffortHrs] = useState("");

  useEffect(() => {
    if (Object.keys(wsBoardState).length > 0) {
      setTasks(wsBoardState);
    }
  }, [wsBoardState]);

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
      setWsBoardState(grouped); 
    } catch (err) {
      console.error("Error fetching tasks:", err);
      showSnackbar("Error fetching tasks", "error");
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

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

  const handleDragStart = (task) => {
    setDragTask(task);
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

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
      const column = tasks[targetStatus];
      const fromIndex = column.findIndex(t => t.id === dragTask.id);
      const toIndex   = dragOverInfo?.columnId === targetStatus ? dragOverInfo.index : column.length - 1;

      if (fromIndex === -1 || fromIndex === toIndex) {
        setDragTask(null); setDragOverInfo(null); return;
      }

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
        setTasks(prev => ({ ...prev, [targetStatus]: column }));
      }
    } else {
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

  const statusConfig = {
    connected:    { label: 'Live',         color: '#2e7d32', bg: '#e8f5e9', dot: '#4caf50', icon: WifiIcon },
    reconnecting: { label: reconnectIn > 0 ? `Reconnecting ${reconnectIn}s` : 'Reconnecting…', color: '#7c4f00', bg: '#fff8e1', dot: '#ff9800', icon: SyncIcon },
    connecting:   { label: 'Connecting…',  color: '#1565c0', bg: '#e3f2fd', dot: '#2196f3', icon: SyncIcon },
  };
  const sc = statusConfig[wsStatus] || statusConfig.connecting;

  const dialogFieldSx = {
    "& .MuiOutlinedInput-root": {
      color: "#1e293b",
      borderRadius: 2,
      "& fieldset": { borderColor: "rgba(0,0,0,0.15)" },
      "&:hover fieldset": { borderColor: "#6366f1" },
      "&.Mui-focused fieldset": { borderColor: "#6366f1" },
    },
    "& .MuiInputLabel-root": { color: "#64748b" },
    "& .MuiInputLabel-root.Mui-focused": { color: "#6366f1" },
    "& input": { color: "#1e293b" },
    "& input::placeholder": { color: "#94a3b8", opacity: 1 },
  };

  return (
    <Box sx={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #fdf4ff 100%)",
      py: { xs: 2, sm: 3, md: 4 },
    }}>
      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2, md: 3 } }}>

        <Box sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          mb: { xs: 2.5, sm: 3.5 },
          px: { xs: 1, sm: 2 },
          py: { xs: 1.5, sm: 2 },
          borderRadius: 3,
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(99,102,241,0.12)",
          boxShadow: "0 4px 24px rgba(99,102,241,0.10)",
        }}>
          {/* Title + subtitle */}
          <Box>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 800,
                fontSize: { xs: "1.4rem", sm: "1.75rem", md: "2rem" },
                background: "linear-gradient(90deg,#4f46e5,#7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "-0.5px",
              }}
            >
              Task Board
            </Typography>
            <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 500 }}>
              {Object.values(tasks).flat().length} tasks across {COLUMNS.length} columns
            </Typography>
          </Box>

          {/* Right side: status pill + avatars + add button */}
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 1.5 }, flexWrap: "wrap" }}>

            {/* 3-state animated pill */}
            <Box sx={{
              display: "flex", alignItems: "center", gap: 0.75,
              px: 1.5, py: 0.5, borderRadius: 99,
              bgcolor: sc.bg, border: `1px solid ${sc.dot}55`,
              boxShadow: `0 0 12px ${sc.dot}33`,
              transition: "all 0.4s ease",
            }}>
              <Box sx={{
                width: 7, height: 7, borderRadius: "50%", bgcolor: sc.dot, flexShrink: 0,
                ...(wsStatus !== "connected" && {
                  animation: "wsPulse 1.2s ease-in-out infinite",
                  "@keyframes wsPulse": {
                    "0%,100%": { opacity: 1, transform: "scale(1)" },
                    "50%":     { opacity: 0.35, transform: "scale(0.7)" },
                  },
                }),
              }} />
              {wsStatus !== "connected" && (
                <SyncIcon sx={{
                  fontSize: 12, color: sc.dot,
                  animation: "wsSpin 1s linear infinite",
                  "@keyframes wsSpin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
                }} />
              )}
              <Typography variant="caption" sx={{ color: sc.color, fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap" }}>
                {sc.label}
              </Typography>
            </Box>

            {/* Connected user avatars */}
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {connectedUsers.map((user) => (
                <Tooltip key={user.id} title={user.name} arrow>
                  <Avatar sx={{
                    width: 30, height: 30, fontSize: 12,
                    bgcolor: user.color,
                    border: "2px solid rgba(255,255,255,0.2)",
                    ml: -0.75,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  }}>
                    {user.name?.[0] || "?"}
                  </Avatar>
                </Tooltip>
              ))}
            </Box>

            {/* Add Task Button */}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
              disabled={!isConnected}
              sx={{
                borderRadius: 99,
                px: { xs: 2, sm: 2.5 },
                py: 0.85,
                fontWeight: 700,
                fontSize: "0.82rem",
                textTransform: "none",
                background: isConnected
                  ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                  : undefined,
                boxShadow: isConnected
                  ? "0 4px 20px rgba(99,102,241,0.5)"
                  : undefined,
                "&:hover": {
                  background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                  boxShadow: "0 6px 24px rgba(99,102,241,0.6)",
                  transform: "translateY(-1px)",
                },
                transition: "all 0.2s ease",
                width: { xs: "100%", sm: "auto" },
              }}
            >
              New Task
            </Button>
          </Box>
        </Box>

        {/* Realtime Status Alert */}
        {wsStatus === "reconnecting" && (
          <Alert
            severity="warning"
            icon={<SyncIcon sx={{ animation: "wsSpin 1s linear infinite", "@keyframes wsSpin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } } }} />}
            sx={{ mb: 2, borderRadius: 2, backdropFilter: "blur(8px)", bgcolor: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}
          >
            Connection lost — board data preserved.{" "}
            {reconnectIn > 0 ? `Reconnecting in ${reconnectIn}s…` : "Reconnecting now…"}
          </Alert>
        )}
        {wsStatus === "connecting" && (
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2, backdropFilter: "blur(8px)", bgcolor: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)", color: "#93c5fd" }}>
            Connecting to live server…
          </Alert>
        )}

        {/* Kanban Columns */}
        <Grid container spacing={{ xs: 1.5, sm: 2 }}>
          {COLUMNS.map((column) => (
            <Grid item xs={12} sm={6} md={4} key={column.id}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  borderRadius: { xs: 2, sm: 3 },
                  background: dragTask && dragTask.status !== column.id
                    ? `${column.light}`
                    : "#ffffff",
                  border: "1px solid rgba(0,0,0,0.06)",
                  borderTop: `3px solid ${column.color}`,
                  boxShadow: dragTask && dragTask.status !== column.id
                    ? `0 0 0 2px ${column.color}44, 0 8px 32px rgba(0,0,0,0.08)`
                    : "0 2px 16px rgba(0,0,0,0.07)",
                  minHeight: { xs: 180, sm: 250, md: 320 },
                  display: "flex",
                  flexDirection: "column",
                  transition: "all 0.25s ease",
                }}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {/* Column header */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, pb: 1.5, borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                  <Box sx={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: column.gradient,
                    boxShadow: `0 0 8px ${column.color}99`,
                  }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, color: "#1e293b", fontSize: { xs: "0.95rem", sm: "1.05rem" } }}>
                    {column.title}
                  </Typography>
                  <Chip
                    label={tasks[column.id]?.length || 0}
                    size="small"
                    sx={{
                      background: column.gradient,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      height: 22,
                      boxShadow: `0 2px 8px ${column.color}55`,
                    }}
                  />
                </Box>

                <Box sx={{ flex: 1 }}>
                  {tasks[column.id]?.length === 0 ? (
                    <Box sx={{ textAlign: "center", mt: 4, opacity: 0.45 }}>
                      <Box sx={{ fontSize: 32, mb: 1 }}>📋</Box>
                      <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 500 }}>
                        No tasks yet
                      </Typography>
                    </Box>
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
                          elevation={0}
                          draggable={isConnected}
                          onDragStart={() => handleDragStart(task)}
                          onDragEnd={handleDragEnd}
                          onDragEnter={(e) => handleCardDragEnter(e, column.id, index)}
                          onDragOver={handleCardDragOver}
                          sx={{
                            p: { xs: 1.25, sm: 1.5 },
                            mb: { xs: 1, sm: 1.25 },
                            borderRadius: 2.5,
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 1,
                            cursor: isConnected ? "grab" : "default",
                            transition: "all 0.22s ease",
                            background: "#ffffff",
                            border: "1px solid rgba(0,0,0,0.07)",
                            borderLeft: `3px solid ${column.color}`,
                            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                            "&:hover": isConnected ? {
                              background: column.light,
                              boxShadow: `0 6px 20px rgba(0,0,0,0.10), 0 0 0 1px ${column.color}33`,
                              transform: "translateY(-2px)",
                            } : {},
                            opacity: dragTask?.id === task.id ? 0.35 : 1,
                          }}
                        >
                          {/* Colored initial avatar */}
                          {task.assignee && (
                            <Avatar sx={{
                              width: 28, height: 28, fontSize: 11, fontWeight: 700, flexShrink: 0, mt: 0.2,
                              background: column.gradient,
                              boxShadow: `0 2px 8px ${column.color}66`,
                            }}>
                              {task.assignee[0].toUpperCase()}
                            </Avatar>
                          )}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{
                              fontWeight: 600,
                              wordBreak: "break-word",
                              mb: 0.75,
                              color: "#1e293b",
                              fontSize: { xs: "0.8rem", sm: "0.85rem" },
                              lineHeight: 1.4,
                            }}>
                              {task.title}
                            </Typography>
                            {/* Metadata chips row */}
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                              {task.assignee && (
                                <Chip
                                  icon={<PersonIcon style={{ fontSize: 11, color: "#94a3b8" }} />}
                                  label={task.assignee}
                                  size="small"
                                  sx={{ height: 18, fontSize: "0.68rem", bgcolor: "rgba(99,102,241,0.08)", color: "#64748b", border: "1px solid rgba(99,102,241,0.12)", "& .MuiChip-icon": { ml: 0.5 } }}
                                />
                              )}
                              {task.deadline && (
                                <Chip
                                  icon={<CalendarIcon style={{ fontSize: 11, color: "#94a3b8" }} />}
                                  label={new Date(task.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                  size="small"
                                  sx={{ height: 18, fontSize: "0.68rem", bgcolor: "rgba(99,102,241,0.08)", color: "#64748b", border: "1px solid rgba(99,102,241,0.12)", "& .MuiChip-icon": { ml: 0.5 } }}
                                />
                              )}
                              {task.effortHrs && (
                                <Chip
                                  icon={<TimeIcon style={{ fontSize: 11, color: "#94a3b8" }} />}
                                  label={`${task.effortHrs}h`}
                                  size="small"
                                  sx={{ height: 18, fontSize: "0.68rem", bgcolor: "rgba(99,102,241,0.08)", color: "#64748b", border: "1px solid rgba(99,102,241,0.12)", "& .MuiChip-icon": { ml: 0.5 } }}
                                />
                              )}
                            </Box>
                          </Box>
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, task)}
                            disabled={!isConnected}
                            sx={{ color: "#94a3b8", "&:hover": { color: "#4f46e5", bgcolor: "rgba(99,102,241,0.08)" }, flexShrink: 0 }}
                          >
                            <MoreVertIcon sx={{ fontSize: 17 }} />
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
          PaperProps={{
            sx: {
              borderRadius: 2.5,
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              minWidth: 180,
              "& .MuiMenuItem-root": {
                fontSize: "0.85rem",
                fontWeight: 500,
                color: "#334155",
                borderRadius: 1.5,
                mx: 0.5,
                my: 0.25,
                "&:hover": { bgcolor: "#f1f5ff", color: "#4f46e5" },
              },
            },
          }}
        >
          <MenuItem onClick={handleOpenEdit}>
            <EditIcon fontSize="small" sx={{ mr: 1.5, color: "#6366f1" }} />
            Edit Task
          </MenuItem>
          {selectedTask && selectedTask.status !== "todo" && (
            <MenuItem onClick={() => handleMoveTask(-1)}>
              <Box component="span" sx={{ mr: 1.5, fontSize: 14 }}>←</Box>
              Move to {COLUMNS[COLUMNS.findIndex((c) => c.id === selectedTask.status) - 1]?.title || "Previous"}
            </MenuItem>
          )}
          {selectedTask && selectedTask.status !== "done" && (
            <MenuItem onClick={() => handleMoveTask(1)}>
              <Box component="span" sx={{ mr: 1.5, fontSize: 14 }}>→</Box>
              Move to {COLUMNS[COLUMNS.findIndex((c) => c.id === selectedTask.status) + 1]?.title || "Next"}
            </MenuItem>
          )}
          <Box sx={{ height: 1, bgcolor: "rgba(0,0,0,0.07)", mx: 1, my: 0.5 }} />
          <MenuItem onClick={handleDeleteTask} sx={{ color: "#ef4444 !important" }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1.5, color: "#ef4444" }} />
            Delete Task
          </MenuItem>
        </Menu>

        {/* Add Task Dialog */}
        <Dialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          fullScreen={fullScreenDialog}
          PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 }, background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 24px 64px rgba(99,102,241,0.15)" } }}
        >
          {/* Dialog color header strip */}
          <Box sx={{ height: 4, background: "linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899)", borderRadius: { xs: 0, sm: "12px 12px 0 0" } }} />
          <DialogTitle sx={{ color: "#1e293b", fontWeight: 700, pb: 0.5, pt: 2 }}>
            ✦ Create New Task
          </DialogTitle>
          <DialogContent sx={{ pt: 1.5 }}>
            <TextField
              autoFocus
              fullWidth
              margin="dense"
              label="Task Title"
              placeholder="What needs to be done?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              variant="outlined"
              sx={dialogFieldSx}
            />
            <TextField
              fullWidth
              margin="dense"
              label="Assignee"
              placeholder="Who owns this?"
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              InputProps={{ startAdornment: <PersonIcon sx={{ mr: 1, color: "#6366f1", fontSize: 18 }} /> }}
              variant="outlined"
              sx={dialogFieldSx}
            />
            <TextField
              fullWidth
              margin="dense"
              label="Deadline"
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              InputProps={{ startAdornment: <CalendarIcon sx={{ mr: 1, color: "#6366f1", fontSize: 18 }} /> }}
              InputLabelProps={{ shrink: true }}
              variant="outlined"
              sx={dialogFieldSx}
            />
            <TextField
              fullWidth
              margin="dense"
              label="Effort Hours"
              type="number"
              placeholder="e.g. 4"
              value={newEffortHrs}
              onChange={(e) => setNewEffortHrs(e.target.value)}
              InputProps={{ startAdornment: <TimeIcon sx={{ mr: 1, color: "#6366f1", fontSize: 18 }} /> }}
              variant="outlined"
              sx={dialogFieldSx}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button
              onClick={() => setAddDialogOpen(false)}
              sx={{ color: "#64748b", borderRadius: 2, textTransform: "none", fontWeight: 600, "&:hover": { bgcolor: "#f1f5ff" } }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddTask}
              variant="contained"
              disabled={!newTitle.trim() || !newAssignee.trim() || !newDeadline || !newEffortHrs}
              sx={{
                borderRadius: 2, textTransform: "none", fontWeight: 700, px: 3,
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
                "&:hover": { background: "linear-gradient(135deg,#4f46e5,#7c3aed)" },
                "&:disabled": { opacity: 0.4 },
              }}
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
          fullScreen={fullScreenDialog}
          PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 }, background: "#ffffff", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 24px 64px rgba(59,130,246,0.12)" } }}
        >
          <Box sx={{ height: 4, background: "linear-gradient(90deg,#3b82f6,#6366f1)", borderRadius: { xs: 0, sm: "12px 12px 0 0" } }} />
          <DialogTitle sx={{ color: "#1e293b", fontWeight: 700, pb: 0.5, pt: 2 }}>✎ Edit Task</DialogTitle>
          <DialogContent sx={{ pt: 1.5 }}>
            <TextField
              autoFocus
              fullWidth
              margin="dense"
              label="Task Title"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyPress={(e) => { if (e.key === "Enter") handleSaveEdit(); }}
              variant="outlined"
              sx={dialogFieldSx}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button
              onClick={() => setEditDialogOpen(false)}
              sx={{ color: "#64748b", borderRadius: 2, textTransform: "none", fontWeight: 600, "&:hover": { bgcolor: "#f1f5ff" } }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              variant="contained"
              disabled={!editText.trim()}
              sx={{
                borderRadius: 2, textTransform: "none", fontWeight: 700, px: 3,
                background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                boxShadow: "0 4px 16px rgba(59,130,246,0.4)",
                "&:hover": { background: "linear-gradient(135deg,#2563eb,#4f46e5)" },
                "&:disabled": { opacity: 0.4 },
              }}
            >
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{
              width: "100%",
              borderRadius: 2.5,
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.08)",
              color: "#1e293b",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              backdropFilter: "blur(12px)",
              fontWeight: 600,
              "& .MuiAlert-icon": { color: snackbar.severity === "success" ? "#22c55e" : "#ef4444" },
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}

export default App;