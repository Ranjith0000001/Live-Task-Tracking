// frontend/src/hooks/useWebSocket.js

import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = 'ws://localhost:5000/ws';

export function useWebSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);
    const [boardState, setBoardState] = useState({ todo: [], inprogress: [], done: [] });
    const [connectedUsers, setConnectedUsers] = useState([]);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return; // Already connected
        }

        console.log('🔄 Connecting to WebSocket...');
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('✅ WebSocket connected');
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 Received:', data);
                setLastMessage(data);

                // Handle different message types
                switch (data.type) {
                    case 'INITIAL_STATE':
                        setBoardState(data.payload);
                        break;

                    case 'USERS_UPDATE':
                        setConnectedUsers(data.payload);
                        break;

                    case 'TASK_ADDED':
                        setBoardState(prev => {
                            const newState = { ...prev };
                            const task = data.payload.task;
                            newState[task.status] = [...(newState[task.status] || []), task];
                            return newState;
                        });
                        break;

                    case 'TASK_UPDATED':
                        setBoardState(prev => {
                            const newState = { ...prev };
                            const task = data.payload.task;
                            const changedStatus = (data.payload.changes && data.payload.changes.status) || task.status;

                            // Remove this task from every column
                            Object.keys(newState).forEach(key => {
                                newState[key] = newState[key].filter(t => t.id !== task.id);
                            });

                            // Add it to the correct target column
                            if (!newState[changedStatus]) {
                                newState[changedStatus] = [];
                            }
                            newState[changedStatus] = [...newState[changedStatus], task];

                            return newState;
                        });
                        break;

                    case 'TASK_DELETED':
                        setBoardState(prev => {
                            const newState = { ...prev };
                            const taskId = data.payload.taskId;
                            // Remove from all columns
                            Object.keys(newState).forEach(key => {
                                newState[key] = newState[key].filter(t => t.id !== taskId);
                            });
                            return newState;
                        });
                        break;

                    default:
                        console.log('Unknown message type:', data.type);
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        ws.onclose = () => {
            console.log('❌ WebSocket disconnected');
            setIsConnected(false);

            // Auto-reconnect after 3 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
                console.log('🔄 Attempting to reconnect...');
                connect();
            }, 3000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            ws.close();
        };

    }, []);

    // Send message to server
    const sendMessage = useCallback((data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
            return true;
        }
        console.warn('WebSocket not connected, cannot send message');
        return false;
    }, []);

    // Connect on mount
    useEffect(() => {
        connect();

        // Cleanup on unmount
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    return {
        isConnected,
        boardState,
        setBoardState, // Allow manual state updates
        lastMessage,
        sendMessage,
        connectedUsers,
        reconnect: connect
    };
}