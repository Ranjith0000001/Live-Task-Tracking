import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000/ws';

const getBackoffDelay = (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000);

export function useWebSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const [wsStatus, setWsStatus] = useState('connecting'); 
    const [reconnectIn, setReconnectIn] = useState(0);     
    const [lastMessage, setLastMessage] = useState(null);
    const [boardState, setBoardState] = useState({ todo: [], inprogress: [], done: [] });
    const [connectedUsers, setConnectedUsers] = useState([]);

    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const countdownIntervalRef = useRef(null);
    const attemptRef = useRef(0);      
    const isFirstConnectRef = useRef(true);

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

    const scheduleReconnect = useCallback((connectFn) => {
        clearTimers();

        const delay = getBackoffDelay(attemptRef.current);
        const seconds = Math.round(delay / 1000);
        setReconnectIn(seconds);


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

        reconnectTimeoutRef.current = setTimeout(() => {
            clearTimers();
            attemptRef.current += 1;
            connectFn();
        }, delay);
    }, []);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN ||
            wsRef.current?.readyState === WebSocket.CONNECTING) {
            return;
        }

        const isRetry = !isFirstConnectRef.current;
        setWsStatus(isRetry ? 'reconnecting' : 'connecting');

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            isFirstConnectRef.current = false;
            attemptRef.current = 0;    
            setReconnectIn(0);
            setIsConnected(true);
            setWsStatus('connected');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setLastMessage(data);

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

                            Object.keys(newState).forEach(key => {
                                newState[key] = newState[key].filter(t => t.id !== task.id);
                            });

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

                    case 'TASK_REORDERED':
                        setBoardState(prev => {
                            const { columnId, orderedIds } = data.payload;
                            const column = prev[columnId] || [];
                            const sorted = orderedIds
                                .map(id => column.find(t => t.id === id))
                                .filter(Boolean);
                            return { ...prev, [columnId]: sorted };
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
            setIsConnected(false);
            setWsStatus('reconnecting');
            scheduleReconnect(connect);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            ws.close(); 
        };

    }, [scheduleReconnect]);

    const sendMessage = useCallback((data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
            return true;
        }
        console.warn('WebSocket not connected, cannot send message');
        return false;
    }, []);

    useEffect(() => {
        connect();

        return () => {
            clearTimers();
            if (wsRef.current) {
                wsRef.current.onclose = null; 
                wsRef.current.close();
            }
        };
    }, [connect]);

    return {
        isConnected,         
        wsStatus,            
        reconnectIn,          
        boardState,
        setBoardState,        
        lastMessage,
        sendMessage,
        connectedUsers,
        reconnect: connect,
    };
}