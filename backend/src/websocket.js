import WebSocket, { WebSocketServer } from 'ws';

const clients = new Map();

const userColors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ff9800', '#ff5722', '#795548'];
const pickColor = () => userColors[Math.floor(Math.random() * userColors.length)];
const createUser = () => ({
  id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
  name: `User ${Math.floor(Math.random() * 9000) + 1000}`,
  color: pickColor(),
});

let currentBoardState = { todo: [], inprogress: [], done: [] };

function broadcastUserList() {
  const users = Array.from(clients.values());
  const msg = JSON.stringify({ type: 'USERS_UPDATE', payload: users });
  clients.forEach((user, client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });


  wss.on('connection', (ws) => {
    const user = createUser();
    clients.set(ws, user);

    broadcastUserList();

    ws.send(JSON.stringify({
      type: 'INITIAL_STATE',
      payload: currentBoardState,
    }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      broadcastUserList();
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
      broadcastUserList();
    });
  });

  return wss;
}

function broadcastUpdate(data) {
  const message = JSON.stringify(data);

  clients.forEach((user, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

function updateCurrentState(tasks) {
  currentBoardState = tasks;
}

function getCurrentState() {
  return currentBoardState;
}

export {
  setupWebSocket,
  broadcastUpdate,
  updateCurrentState,
  getCurrentState,
};
