import { useState } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: '#ff9800' },
  { id: 'inprogress', title: 'In Progress', color: '#2196f3' },
  { id: 'done', title: 'Done', color: '#4caf50' },
];

function App() {
  const [tasks, setTasks] = useState({
    todo: [
      { id: 1, text: 'Design landing page' },
      { id: 2, text: 'Set up CI/CD pipeline' },
    ],
    inprogress: [{ id: 3, text: 'Implement authentication' }],
    done: [{ id: 4, text: 'Research requirements' }],
  });
  const [newTaskText, setNewTaskText] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    const newTask = {
      id: Date.now(),
      text: newTaskText.trim(),
    };
    setTasks((prev) => ({
      ...prev,
      todo: [...prev.todo, newTask],
    }));
    setNewTaskText('');
  };

  const handleDeleteTask = (columnId, taskId) => {
    setTasks((prev) => ({
      ...prev,
      [columnId]: prev[columnId].filter((t) => t.id !== taskId),
    }));
    setAnchorEl(null);
  };

  const handleMoveTask = (columnId, taskId, direction) => {
    const columnOrder = ['todo', 'inprogress', 'done'];
    const currentIndex = columnOrder.indexOf(columnId);
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= columnOrder.length) return;

    const task = tasks[columnId].find((t) => t.id === taskId);
    if (!task) return;

    setTasks((prev) => ({
      ...prev,
      [columnId]: prev[columnId].filter((t) => t.id !== taskId),
      [columnOrder[targetIndex]]: [
        ...prev[columnOrder[targetIndex]],
        { ...task },
      ],
    }));
    setAnchorEl(null);
  };

  const handleMenuOpen = (event, task, columnId) => {
    setAnchorEl(event.currentTarget);
    setSelectedTask({ ...task, columnId });
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTask(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleAddTask();
  };

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        <Typography
          variant="h4"
          component="h1"
          align="center"
          gutterBottom
          sx={{ fontWeight: 700, mb: 4, color: '#333' }}
        >
          Task Board
        </Typography>

        {/* Add Task Input */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 4,
            display: 'flex',
            gap: 2,
            borderRadius: 2,
            border: '1px solid #e0e0e0',
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="Enter task description..."
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyPress={handleKeyPress}
            variant="outlined"
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddTask}
            disabled={!newTaskText.trim()}
            sx={{ whiteSpace: 'nowrap', minWidth: 120 }}
          >
            Add Task
          </Button>
        </Paper>

        {/* Kanban Columns */}
        <Grid container spacing={2}>
          {COLUMNS.map((column) => (
            <Grid item xs={12} md={4} key={column.id}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid #e0e0e0',
                  minHeight: 300,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
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
                      borderRadius: '50%',
                      bgcolor: column.color,
                    }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
                    {column.title}
                  </Typography>
                  <Chip
                    label={tasks[column.id].length}
                    size="small"
                    sx={{
                      bgcolor: column.color,
                      color: '#fff',
                      fontWeight: 600,
                    }}
                  />
                </Box>

                <Box sx={{ flex: 1 }}>
                  {tasks[column.id].length === 0 ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      align="center"
                      sx={{ mt: 4 }}
                    >
                      No tasks
                    </Typography>
                  ) : (
                    tasks[column.id].map((task) => (
                      <Paper
                        key={task.id}
                        elevation={1}
                        sx={{
                          p: 1.5,
                          mb: 1.5,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          transition: 'all 0.2s',
                          '&:hover': {
                            boxShadow: 3,
                            transform: 'translateY(-1px)',
                          },
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ flex: 1, wordBreak: 'break-word' }}
                        >
                          {task.text}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, task, column.id)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Paper>
                    ))
                  )}
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Task Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          {selectedTask && (
            <>
              {selectedTask.columnId !== 'todo' && (
                <MenuItem
                  onClick={() =>
                    handleMoveTask(
                      selectedTask.columnId,
                      selectedTask.id,
                      -1
                    )
                  }
                >
                  ← Move to{' '}
                  {COLUMNS[COLUMNS.findIndex((c) => c.id === selectedTask.columnId) - 1]?.title}
                </MenuItem>
              )}
              {selectedTask.columnId !== 'done' && (
                <MenuItem
                  onClick={() =>
                    handleMoveTask(
                      selectedTask.columnId,
                      selectedTask.id,
                      1
                    )
                  }
                >
                  Move to{' '}
                  {COLUMNS[COLUMNS.findIndex((c) => c.id === selectedTask.columnId) + 1]?.title}{' '}
                  →
                </MenuItem>
              )}
              <MenuItem
                onClick={() =>
                  handleDeleteTask(selectedTask.columnId, selectedTask.id)
                }
                sx={{ color: 'error.main' }}
              >
                <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                Delete
              </MenuItem>
            </>
          )}
        </Menu>
      </Container>
    </Box>
  );
}

export default App;