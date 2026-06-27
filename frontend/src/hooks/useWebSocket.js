// frontend/src/hooks/useWebSocket.js

import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = 'ws://localhost:5000/ws';

// Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
const getBackoffDelay = (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000);

export function useWebSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const [wsStatus, setWsStatus] = useState('connecting'); // 'connecting' | 'reconnecting' | 'connected'
    const [reconnectIn, setReconnectIn] = useState(0);      // seconds until next attempt
    const [lastMessage, setLastMessage] = useState(null);
    const [boardState, setBoardState] = useState({ todo: [], inprogress: [], done: [] });
    const [connectedUsers, setConnectedUsers] = useState([]);

    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const countdownIntervalRef = useRef(null);
    const attemptRef = useRef(0);       // how many consecutive failures
    const isFirstConnectRef = useRef(true);

    // Clear any pending reconnect timers
    const clearTimers = () => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
    };

    // Start a visible countdown then fire connect()
    const scheduleReconnect = useCallback((connectFn) => {
        clearTimers();

        const delay = getBackoffDelay(attemptRef.current);
        const seconds = Math.round(delay / 1000);
        setReconnectIn(seconds);

        console.log(`🔁 Reconnecting in ${seconds}s (attempt ${attemptRef.current + 1})`);

        // Tick countdown every second
        countdownIntervalRef.current = setInterval(() => {
            setReconnectIn(prev => {
                if (prev <= 1) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Fire reconnect after full delay
        reconnectTimeoutRef.current = setTimeout(() => {
            clearTimers();
            attemptRef.current += 1;
            connectFn();
        }, delay);
    }, []);

    const connect = useCallback(() => {
        // Don't stack connections
        if (wsRef.current?.readyState === WebSocket.OPEN ||
            wsRef.current?.readyState === WebSocket.CONNECTING) {
            return;
        }

        const isRetry = !isFirstConnectRef.current;
        setWsStatus(isRetry ? 'reconnecting' : 'connecting');
        console.log(isRetry ? '🔄 Reconnecting to WebSocket...' : '🔄 Connecting to WebSocket...');

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('✅ WebSocket connected');
            isFirstConnectRef.current = false;
            attemptRef.current = 0;     // reset backoff on success
            setReconnectIn(0);
            setIsConnected(true);
            setWsStatus('connected');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 Received:', data);
                setLastMessage(data);

                switch (data.type) {
                    // INITIAL_STATE is sent on every (re)connection — this is the re-sync
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
            setWsStatus('reconnecting');
            scheduleReconnect(connect);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            ws.close(); // triggers onclose → scheduleReconnect
        };

    }, [scheduleReconnect]);

    // Send message to server
    const sendMessage = useCallback((data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
            return true;
        }
        console.warn('WebSocket not connected, cannot send message');
        return false;
    }, []);

    // Connect on mount, full cleanup on unmount
    useEffect(() => {
        connect();

        return () => {
            clearTimers();
            if (wsRef.current) {
                wsRef.current.onclose = null; // prevent reconnect loop on intentional unmount
                wsRef.current.close();
            }
        };
    }, [connect]);

    return {
        isConnected,          // boolean — existing consumers unchanged
        wsStatus,             // 'connecting' | 'reconnecting' | 'connected'
        reconnectIn,          // seconds until next attempt (for the countdown UI)
        boardState,
        setBoardState,        // Allow manual state updates
        lastMessage,
        sendMessage,
        connectedUsers,
        reconnect: connect,
    };
}