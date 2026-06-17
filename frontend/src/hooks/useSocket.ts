// frontend/src/hooks/useSocket.ts
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState } from '../types/game';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://card-game-1-uxkv.onrender.com';

export interface TakeCardsRequestData {
  requesterId: string;
  requesterName: string;
}

export interface TradeRequestData {
  requesterId: string;
  requesterName: string;
  targetId: string;
  offeredCardId: number;
  requestedCardId: number;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string }[]>([]);
  const [myUser, setMyUser] = useState<{ id: string; username: string; coins: number; rank: number; xp: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [takeRequest, setTakeRequest] = useState<TakeCardsRequestData | null>(null);
  const [tradeRequest, setTradeRequest] = useState<TradeRequestData | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('registered', (user) => setMyUser(user));

    socket.on('roomUpdated', (state: GameState) => setGameState(state));

    socket.on('chatMessage', (msg: { sender: string; text: string }) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on('error', (err: string) => {
      setErrorMsg(err);
      setTimeout(() => setErrorMsg(null), 4000);
    });

    // Take cards request incoming
    socket.on('takeCardsRequest', (data: TakeCardsRequestData) => {
      setTakeRequest(data);
    });

    // Trade request incoming
    socket.on('tradeRequest', (data: TradeRequestData) => {
      setTradeRequest(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const registerGuest = (username: string) => socketRef.current?.emit('registerGuest', { username });

  const joinRoom = (roomId: string, username: string) => socketRef.current?.emit('joinRoom', { roomId, username });

  const leaveRoom = (roomId: string) => {
    socketRef.current?.emit('leaveRoom', roomId);
    setGameState(null);
    setChatMessages([]);
    setTakeRequest(null);
    setTradeRequest(null);
  };

  const toggleReady = () => socketRef.current?.emit('toggleReady');

  const startGame = () => socketRef.current?.emit('startGame');

  const startBotGame = (totalPlayers: number) => {
    setChatMessages([]);
    socketRef.current?.emit('startBotGame', { totalPlayers });
  };

  const playCard = (card: any) => socketRef.current?.emit('playCard', card);

  const sendMessage = (text: string) => socketRef.current?.emit('sendMessage', text);

  const sendEmojiReaction = (emoji: string) => socketRef.current?.emit('emojiReaction', emoji);

  // Take cards: request to take all of target's cards
  const requestTakeCards = (targetPlayerId: string) =>
    socketRef.current?.emit('requestTakeCards', { targetPlayerId });

  // Respond to take cards request
  const respondTakeCards = (targetPlayerId: string, accept: boolean) => {
    socketRef.current?.emit('respondTakeCards', { targetPlayerId, accept });
    setTakeRequest(null);
  };

  // Trade cards: request to swap a specific card
  const requestTradeCards = (targetPlayerId: string, offeredCardId: number, requestedCardId: number) =>
    socketRef.current?.emit('requestTradeCards', { targetPlayerId, offeredCardId, requestedCardId });

  // Respond to a trade request
  const respondTradeCards = (targetPlayerId: string, accept: boolean) => {
    socketRef.current?.emit('respondTradeCards', { targetPlayerId, accept });
    setTradeRequest(null);
  };

  // Play Again after game over
  const playAgainReady = () => socketRef.current?.emit('playAgainReady');

  return {
    socket: socketRef.current,
    connected,
    gameState,
    chatMessages,
    myUser,
    errorMsg,
    takeRequest,
    tradeRequest,
    registerGuest,
    joinRoom,
    leaveRoom,
    toggleReady,
    startGame,
    startBotGame,
    playCard,
    sendMessage,
    sendEmojiReaction,
    requestTakeCards,
    respondTakeCards,
    requestTradeCards,
    respondTradeCards,
    playAgainReady,
  };
}
