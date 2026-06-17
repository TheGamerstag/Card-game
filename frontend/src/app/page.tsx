// frontend/src/app/page.tsx
'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSocket } from '../hooks/useSocket';
import { PlayingCard } from '../components/PlayingCard';
import { BrandLogo } from '../components/BrandLogo';
import { SiteFooter } from '../components/SiteFooter';
import {
  Heart,
  Trophy,
  Users,
  Send,
  LogOut,
  ArrowRight,
  Bot,
  Wifi,
  WifiOff,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#07080c] text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500 mx-auto mb-4"></div>
            <p className="text-sm text-slate-400 font-medium">Loading Bhabii Card Game...</p>
          </div>
        </div>
      }
    >
      <GameAppContent />
    </Suspense>
  );
}

function GameAppContent() {
  const {
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
  } = useSocket();

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // URL-derived routing states
  const activeTab = (searchParams.get('tab') as 'play' | 'leaderboard') || 'play';
  const roomIdUrl = searchParams.get('room') || '';

  const [usernameInput, setUsernameInput] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [msgInput, setMsgInput] = useState('');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [botPlayerCount, setBotPlayerCount] = useState(4);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Load leaderboard when tab is active
  useEffect(() => {
    if (activeTab === 'leaderboard') {
      const apiUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://card-game-1-uxkv.onrender.com';
      fetch(`${apiUrl}/api/users/leaderboard`)
        .then(res => res.json())
        .then(data => setLeaderboard(data))
        .catch(err => console.error('Failed to load leaderboard', err));
    }
  }, [activeTab]);

  // Sync username from localStorage on connect
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername && !myUser && connected) {
      registerGuest(storedUsername);
    }
  }, [connected, myUser]);

  // Sync room URL to client state (reconnect/auto-join)
  useEffect(() => {
    if (connected && myUser && roomIdUrl && !gameState) {
      joinRoom(roomIdUrl, myUser.username);
    }
  }, [connected, myUser, roomIdUrl, gameState]);

  // Sync gameState room code to URL
  useEffect(() => {
    if (gameState) {
      if (roomIdUrl !== gameState.roomId) {
        const params = new URLSearchParams(window.location.search);
        params.set('room', gameState.roomId);
        router.push(`${pathname}?${params.toString()}`);
      }
    }
  }, [gameState, roomIdUrl, pathname, router]);

  // Sync browser back/forward buttons (if room param deleted from URL, leave room)
  useEffect(() => {
    if (gameState && !roomIdUrl) {
      leaveRoom(gameState.roomId);
    }
  }, [roomIdUrl, gameState]);

  const setActiveTab = (tab: 'play' | 'leaderboard') => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'play') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim()) {
      const name = usernameInput.trim();
      registerGuest(name);
      localStorage.setItem('username', name);
    }
  };

  const handleLogOut = () => {
    if (gameState) {
      leaveRoom(gameState.roomId);
    }
    localStorage.removeItem('username');
    window.location.href = '/';
  };

  const handleCreatePrivate = () => {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    if (myUser) {
      joinRoom(randomCode, myUser.username);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomInput.trim() && myUser) {
      joinRoom(roomInput.trim().toUpperCase(), myUser.username);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (msgInput.trim()) {
      sendMessage(msgInput.trim());
      setMsgInput('');
    }
  };

  if (!myUser) {
    return (
      <main className="min-h-screen flex flex-col relative z-10">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <BrandLogo size="lg" showTagline />
            </div>

            <div className="glass-panel-elevated rounded-3xl p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

              <div className="flex flex-wrap justify-center gap-2 mb-8">
                {['Multiplayer', 'Ranked ELO', 'Private Rooms', 'vs CPU'].map((label) => (
                  <span key={label} className="feature-pill text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                    {label}
                  </span>
                ))}
              </div>

              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Choose your display name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CardKing"
                    value={usernameInput}
                    onChange={e => setUsernameInput(e.target.value)}
                    maxLength={12}
                    className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3.5 btn-primary text-black font-bold rounded-xl flex items-center justify-center gap-2"
                >
                  Enter Bhabii <ArrowRight className="w-5 h-5" />
                </button>
              </form>

              <p className="text-center text-[11px] text-slate-500 mt-6 leading-relaxed">
                No account needed — jump in as a guest and start playing in seconds.
              </p>
            </div>
          </div>
        </div>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col relative z-10">
      <header className="h-16 border-b border-white/5 bg-black/40 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4 sm:gap-8">
          <BrandLogo size="sm" />
          <nav className="flex gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('play')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'play' ? 'nav-tab-active' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Play
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'leaderboard' ? 'nav-tab-active' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Leaderboard
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div
            className={`hidden md:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
              connected
                ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
                : 'text-rose-400 border-rose-500/20 bg-rose-500/10'
            }`}
          >
            {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {connected ? 'Online' : 'Offline'}
          </div>
          <div className="text-right">
            <div className="text-xs sm:text-sm font-bold text-white leading-tight">{myUser.username}</div>
            <div className="text-[10px] sm:text-xs text-amber-400/90 font-medium">{myUser.rank} ELO</div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-amber-500/25 overflow-hidden bg-slate-900 ring-2 ring-amber-500/10">
            <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${myUser.username}`} alt="Avatar" />
          </div>
          <button
            onClick={handleLogOut}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-lg hover:bg-white/5"
            title="Log Out / Switch Account"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      {errorMsg && (
        <div className="bg-rose-500/20 border border-rose-500/40 text-rose-300 py-3 px-6 text-center text-sm font-semibold sticky top-16 z-40 animate-pulse">
          {errorMsg}
        </div>
      )}

      {activeTab === 'leaderboard' ? (
        <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8">
          <div className="glass-panel-elevated rounded-2xl p-6 sm:p-8">
            <h3 className="text-xl sm:text-2xl font-bold mb-2 flex items-center gap-2 text-amber-400">
              <Trophy className="w-5 sm:w-6 h-5 sm:h-6" /> Leaderboard
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 sm:mb-8">Top ranked Bhabii players by ELO.</p>
            <div className="space-y-3">
              {leaderboard.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">No ranked players yet — be the first!</div>
              ) : (
                leaderboard.map((user, idx) => (
                  <div
                    key={user.id}
                    className={`flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-all ${
                      idx === 0
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-black/30 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <span
                        className={`text-base sm:text-lg font-bold w-6 sm:w-8 ${
                          idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-700' : 'text-slate-500'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <img
                        src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                        alt="Avatar"
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-white/10"
                      />
                      <div>
                        <div className="font-bold text-sm sm:text-base text-white">{user.username}</div>
                        <div className="text-[10px] sm:text-xs text-slate-400">
                          {user.wins}W · {user.losses}L
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-extrabold text-sm sm:text-base text-amber-400">{user.rank}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Play tab container */
        <div className="flex-1 flex overflow-hidden">
          {!gameState ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
              <div className="w-full max-w-2xl mb-6 sm:mb-8 text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Welcome back, {myUser.username}</h2>
                <p className="text-slate-400 text-xs sm:text-sm">Create a room, join friends, or sharpen your skills against CPU.</p>
              </div>

              <div className="w-full max-w-2xl grid md:grid-cols-2 gap-6">
                <div className="glass-panel-elevated rounded-2xl p-6 space-y-5">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-400" />
                    Multiplayer
                  </h3>

                  <button
                    onClick={handleCreatePrivate}
                    className="w-full py-3.5 btn-primary text-black font-bold rounded-xl flex items-center justify-center gap-2 text-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    Create Private Room
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-white/5" />
                    <span className="flex-shrink mx-3 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Join</span>
                    <div className="flex-grow border-t border-white/5" />
                  </div>

                  <form onSubmit={handleJoin} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ROOM CODE"
                      value={roomInput}
                      onChange={e => setRoomInput(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:outline-none focus:ring-1 focus:ring-amber-500/50 text-center tracking-widest font-mono uppercase text-sm"
                    />
                    <button type="submit" className="px-5 btn-secondary rounded-xl font-bold text-sm">
                      Join
                    </button>
                  </form>
                </div>

                <div className="glass-panel rounded-2xl p-6 space-y-5 border-emerald-500/10">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Bot className="w-5 h-5 text-emerald-400" />
                    Solo vs CPU
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Practice mode with {botPlayerCount - 1} CPU opponent{botPlayerCount - 1 === 1 ? '' : 's'}. Choose table size:
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 4, 5, 6].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setBotPlayerCount(count)}
                        className={`py-2 rounded-lg text-sm font-bold transition-all ${
                          botPlayerCount === count
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                            : 'bg-black/40 text-slate-400 hover:bg-black/60 hover:text-white border border-white/5'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => startBotGame(botPlayerCount)}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-sm"
                  >
                    <Bot className="w-5 h-5" />
                    Start Bot Game
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Inside Game Room Layout */
            <div className="flex-1 flex relative overflow-hidden">
              
              {/* Left Column: Room Game Table */}
              <div className="flex-1 flex flex-col relative overflow-hidden">
                {gameState.status === 'LOBBY' ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
                    <div className="glass-panel-elevated max-w-md w-full p-6 sm:p-8 rounded-2xl text-center space-y-6">
                      <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Room Code</div>
                      <div className="text-3xl sm:text-4xl font-extrabold tracking-widest text-amber-400 font-mono bg-black/40 py-4 rounded-xl border border-amber-500/20">
                        {gameState.roomId}
                      </div>

                      <div className="space-y-3 text-left">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Players list</div>
                        {gameState.players.map((p) => (
                          <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-900">
                            <div className="flex items-center gap-2">
                              <img src={p.avatar} alt="Avatar" className="w-8 h-8" />
                              <span className="font-medium text-sm text-white">{p.username}</span>
                            </div>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${p.isReady ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                              {p.isReady ? 'Ready' : 'Not Ready'}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={toggleReady}
                          className="flex-1 py-3 btn-secondary font-bold rounded-xl text-sm"
                        >
                          {gameState.players.find(p => p.id === myUser.id)?.isReady ? 'Unready' : 'Ready Up'}
                        </button>

                        <button
                          onClick={startGame}
                          className="flex-1 py-3 btn-primary text-black font-bold rounded-xl text-sm"
                        >
                          Start Game
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* PLAYING Game Stage: Server Authoritative Felt Table */
                  <div className="flex-1 flex flex-col felt-table relative overflow-hidden">
                    
                    {/* Top: Opponent status bars */}
                    <div className="h-24 flex items-center justify-start sm:justify-center gap-4 p-4 overflow-x-auto max-w-full no-scrollbar">
                      {gameState.players
                        .filter(p => p.username !== myUser.username)
                        .map((p) => {
                          const isCurrentTurn = gameState.players[gameState.currentTurn]?.id === p.id;
                          return (
                            <div
                              key={p.id}
                              className={`relative px-4 py-2 rounded-xl flex items-center gap-3 transition-all duration-300 flex-shrink-0
                                ${isCurrentTurn ? 'bg-amber-500/20 border border-amber-500/40 shadow-lg shadow-amber-500/10 scale-105' : 'bg-black/50 border border-white/5'}
                              `}
                            >
                              <div className="w-8 h-8 rounded-full bg-slate-900 overflow-hidden relative">
                                <img src={p.avatar} alt="Avatar" />
                              </div>
                              <div>
                                <div className="text-xs font-bold flex items-center gap-1.5 text-white">
                                  {p.username}
                                  {p.isBot && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 fill-current font-bold uppercase">
                                      CPU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400">{p.cards.length} cards left</div>
                              </div>
                              {p.leftGame && (
                                <span className="absolute -top-2 -right-2 bg-emerald-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                  Safe
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>

                    {/* Center: Trick arena / Felt board */}
                    <div className="flex-1 flex flex-col items-center justify-center relative p-4">
                      <div className="text-center mb-4 z-10">
                        {gameState.currentSuit ? (
                          <div className="text-xs uppercase tracking-wider text-slate-400 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                            Lead Suit: <span className="font-extrabold text-white">{gameState.currentSuit}</span>
                          </div>
                        ) : (
                          <div className="text-xs uppercase tracking-wider text-slate-400 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                            Waiting for lead play...
                          </div>
                        )}
                      </div>

                      {/* Played cards in the current trick */}
                      <div className="flex items-center justify-center gap-4 h-40 max-w-full overflow-x-auto py-2 px-6">
                        {gameState.trickCards.map((act) => {
                          const player = gameState.players.find(p => p.id === act.playerId);
                          return (
                            <div key={act.card.id} className="flex flex-col items-center flex-shrink-0">
                              <PlayingCard card={act.card} disabled={true} isPlayable={true} />
                              <span className="text-[10px] text-slate-300 mt-2 bg-slate-950/80 border border-white/5 px-2 py-0.5 rounded font-medium">
                                {player?.username}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {gameState.status === 'GAME_OVER' && (
                        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-6 z-30">
                          <h2 className="text-3xl sm:text-4xl font-extrabold text-red-500 mb-2">GAME OVER</h2>
                          {gameState.loserId === myUser.id ? (
                            <p className="text-slate-300 mb-2 text-sm sm:text-base">
                              You got the <span className="font-bold text-red-400">Thulla</span> — better luck next time!
                            </p>
                          ) : gameState.winnerOrder.includes(myUser.id) ? (
                            <p className="text-slate-300 mb-2 text-sm sm:text-base">
                              You went out safely! <span className="font-bold text-emerald-400">Nice play.</span>
                            </p>
                          ) : null}
                          <p className="text-slate-300 mb-6 text-sm sm:text-base">
                            Loser (Thulla Receiver):{' '}
                            <span className="font-bold text-white">
                              {gameState.players.find(p => p.id === gameState.loserId)?.username}
                            </span>
                          </p>
                          <button
                            onClick={() => leaveRoom(gameState.roomId)}
                            className="px-8 py-3 btn-primary text-black font-bold rounded-xl text-sm"
                          >
                            Return to Lobby
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Bottom: Player's own hand */}
                    <div className="bg-black/60 border-t border-white/5 p-4 sm:p-6 flex flex-col items-center backdrop-blur-sm relative z-20">
                      <div className="flex items-center justify-between w-full max-w-4xl mb-3">
                        <div className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                          <span>Your Hand</span>
                          <span className="bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-xs text-amber-400">
                            {gameState.players.find(p => p.id === myUser.id)?.cards.length || 0} cards
                          </span>
                        </div>
                        {gameState.players[gameState.currentTurn]?.id === myUser.id && (
                          <div className="text-[10px] sm:text-xs bg-amber-500 text-black font-bold px-3 py-1 rounded-full animate-pulse">
                            Your Turn
                          </div>
                        )}
                      </div>

                      {/* Deck container fanned layout */}
                      <div className="flex items-center justify-center -space-x-10 hover:-space-x-2 transition-all duration-300 max-w-full px-8 pb-4 overflow-x-auto overflow-y-visible py-6 no-scrollbar">
                        {gameState.players
                          .find(p => p.id === myUser.id)
                          ?.cards.map((card, cardIdx) => {
                            const isMyTurn = gameState.players[gameState.currentTurn]?.id === myUser.id;
                            return (
                              <div
                                key={card.id}
                                className="relative transition-all duration-300 hover:z-50 flex-shrink-0"
                                style={{
                                  zIndex: cardIdx + 2,
                                }}
                              >
                                <PlayingCard
                                  card={card}
                                  isPlayable={true}
                                  onClick={() => {
                                    if (isMyTurn) playCard(card);
                                  }}
                                />
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Floating Chat Trigger for Mobile */}
              {gameState.status === 'PLAYING' && (
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="lg:hidden fixed bottom-6 right-6 z-30 p-3.5 bg-amber-500 text-black rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all"
                  title="Open Chat"
                >
                  <MessageSquare className="w-5 h-5" />
                </button>
              )}

              {/* Chat Sidebar Backdrop (Mobile Only) */}
              {isChatOpen && (
                <div
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
                  onClick={() => setIsChatOpen(false)}
                />
              )}

              {/* Right Column: Chat & Room Controls */}
              <div
                className={`
                  fixed inset-y-0 right-0 z-50 w-80 bg-zinc-950 border-l border-white/10 flex flex-col transition-transform duration-300 shadow-2xl
                  lg:static lg:translate-x-0 lg:shadow-none lg:w-80 lg:border-l lg:border-white/5 lg:bg-black/40 lg:backdrop-blur-sm
                  ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
              >
                <div className="p-4 border-b border-slate-900 flex justify-between items-center">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {gameState.isBotRoom ? 'Bot Game Log' : 'Lobby Chat'}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => leaveRoom(gameState.roomId)}
                      className="p-1 text-slate-400 hover:text-white transition-all rounded hover:bg-slate-900"
                      title="Leave Room"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsChatOpen(false)}
                      className="lg:hidden p-1 text-slate-400 hover:text-white transition-all rounded hover:bg-slate-900 text-xs font-extrabold uppercase px-2 border border-white/10"
                      title="Close Chat"
                    >
                      Close
                    </button>
                  </div>
                </div>

                {/* Chat Message Scroll */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {chatMessages.map((msg, index) => (
                    <div key={index} className="text-sm">
                      <span className={`font-bold mr-1.5 ${msg.sender === 'System' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {msg.sender}:
                      </span>
                      <span className="text-slate-300">{msg.text}</span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat controls & Quick reactions */}
                <div className="p-4 border-t border-slate-900 space-y-3">
                  <div className="flex justify-between">
                    {['😂', '🔥', '😎', '💀'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => sendEmojiReaction(emoji)}
                        className="p-1.5 hover:bg-slate-900 rounded-lg active:scale-95 transition-all text-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSendChat} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={msgInput}
                      onChange={e => setMsgInput(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm rounded-lg bg-black/40 border border-white/10 focus:outline-none focus:ring-1 focus:ring-amber-500/50 text-white"
                    />
                    <button
                      type="submit"
                      className="p-2 btn-primary text-black rounded-lg"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <SiteFooter />
    </main>
  );
}
