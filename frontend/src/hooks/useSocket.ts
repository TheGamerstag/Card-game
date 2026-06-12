// frontend/src/hooks/useSocket.ts
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState } from '../types/game';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string }[]>([]);
  const [myUser, setMyUser] = useState<{ id: string; username: string; coins: number; rank: number; xp: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('registered', (user) => {
      setMyUser(user);
    });

    socket.on('roomUpdated', (state: GameState) => {
      setGameState(state);
    });

    socket.on('chatMessage', (msg: { sender: string; text: string }) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on('error', (err: string) => {
      setErrorMsg(err);
      setTimeout(() => setErrorMsg(null), 4000);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const registerGuest = (username: string) => {
    socketRef.current?.emit('registerGuest', { username });
  };

  const joinRoom = (roomId: string, username: string) => {
    socketRef.current?.emit('joinRoom', { roomId, username });
  };

  const leaveRoom = (roomId: string) => {
    socketRef.current?.emit('leaveRoom', roomId);
    setGameState(null);
    setChatMessages([]);
  };

  const toggleReady = () => {
    socketRef.current?.emit('toggleReady');
  };

  const startGame = () => {
    socketRef.current?.emit('startGame');
  };

  const startBotGame = (totalPlayers: number) => {
    setChatMessages([]);
    socketRef.current?.emit('startBotGame', { totalPlayers });
  };

  const playCard = (card: any) => {
    socketRef.current?.emit('playCard', card);
  };

  const sendMessage = (text: string) => {
    socketRef.current?.emit('sendMessage', text);
  };

  const sendEmojiReaction = (emoji: string) => {
    socketRef.current?.emit('emojiReaction', emoji);
  };

  return {
    socket: socketRef.current,
    connected,
    gameState,
    chatMessages,
    myUser,
    errorMsg,
    registerGuest,
    joinRoom,
    leaveRoom,
    toggleReady,
    startGame,
    startBotGame,
    playCard,
    sendMessage,
    sendEmojiReaction,
  };
}
