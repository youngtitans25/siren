
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SirenSession } from './services/geminiLiveService';
import { ConnectionStatus, Message } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<SirenSession | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleMessage = useCallback((text: string, isUser: boolean) => {
    setMessages(prev => {
      // Very basic streaming logic for transcription:
      // If the last message is from the same role, we could append, but let's keep it simple for now.
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === (isUser ? 'user' : 'siren')) {
          // If we want real-time appending, we'd need more complex logic.
          // For now, let's just add new chunks as they come.
          return [...prev, { role: isUser ? 'user' : 'siren', text }];
      }
      return [...prev, { role: isUser ? 'user' : 'siren', text }];
    });
  }, []);

  const toggleConnection = async () => {
    if (status === ConnectionStatus.CONNECTED) {
      sessionRef.current?.stop();
      setStatus(ConnectionStatus.DISCONNECTED);
      return;
    }

    setError(null);
    setStatus(ConnectionStatus.CONNECTING);

    const session = new SirenSession(
      handleMessage,
      (err) => {
        setError(err);
        setStatus(ConnectionStatus.ERROR);
      },
      (newStatus) => {
        if (newStatus === 'connected') setStatus(ConnectionStatus.CONNECTED);
        if (newStatus === 'disconnected') setStatus(ConnectionStatus.DISCONNECTED);
        if (newStatus === 'error') setStatus(ConnectionStatus.ERROR);
      }
    );

    sessionRef.current = session;
    await session.start();
  };

  return (
    <div className="min-h-screen siren-gradient flex flex-col items-center justify-center p-6 relative">
      {/* Visual Ambiance */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-900/10 blur-[120px] rounded-full glow-pulse"></div>
      </div>

      <header className="mb-12 text-center relative z-10">
        <h1 className="text-6xl md:text-8xl font-serif italic text-rose-500 mb-2 drop-shadow-lg">Siren</h1>
        <p className="text-zinc-400 tracking-[0.2em] uppercase text-xs">Intimate AI Companion</p>
      </header>

      <main className="w-full max-w-2xl flex flex-col items-center relative z-10">
        
        {/* The Pulsing Core */}
        <div className={`relative mb-16 transition-all duration-700 ${status === ConnectionStatus.CONNECTED ? 'scale-110' : 'scale-90 opacity-60'}`}>
          <div className={`w-48 h-48 rounded-full flex items-center justify-center transition-all duration-1000 ${status === ConnectionStatus.CONNECTED ? 'bg-rose-600/20 shadow-[0_0_80px_rgba(225,29,72,0.3)]' : 'bg-zinc-800/20'}`}>
            <div className={`w-32 h-32 rounded-full border-2 border-rose-500/30 flex items-center justify-center ${status === ConnectionStatus.CONNECTED ? 'animate-[pulse_2s_infinite]' : ''}`}>
               <div className={`w-16 h-16 rounded-full bg-rose-600 shadow-[0_0_30px_rgba(225,29,72,0.8)] transition-all ${status === ConnectionStatus.CONNECTED ? 'scale-110 blur-[1px]' : 'scale-75 blur-[4px]'}`}></div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={toggleConnection}
          disabled={status === ConnectionStatus.CONNECTING}
          className={`px-12 py-4 rounded-full font-semibold text-lg tracking-widest transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 ${
            status === ConnectionStatus.CONNECTED
              ? 'bg-zinc-100 text-zinc-950 hover:bg-white'
              : 'bg-rose-600 text-white hover:bg-rose-500 shadow-xl shadow-rose-900/20'
          }`}
        >
          {status === ConnectionStatus.DISCONNECTED && 'ENTER THE LOUNGE'}
          {status === ConnectionStatus.CONNECTING && 'PREPARING...'}
          {status === ConnectionStatus.CONNECTED && 'LEAVE SIREN'}
          {status === ConnectionStatus.ERROR && 'TRY AGAIN'}
        </button>

        {error && (
          <p className="mt-4 text-rose-400 text-sm italic">{error}</p>
        )}

        {/* Transcription Log */}
        <div className="mt-12 w-full h-48 bg-zinc-950/40 backdrop-blur-md border border-zinc-800/50 rounded-2xl p-6 overflow-y-auto" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-zinc-600 italic text-sm">Waiting for your voice...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] uppercase tracking-tighter text-zinc-500 mb-1">
                    {msg.role === 'user' ? 'You' : 'Siren'}
                  </span>
                  <p className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-zinc-800 text-zinc-200' 
                      : 'bg-rose-900/30 text-rose-100 italic'
                  }`}>
                    {msg.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="mt-12 text-zinc-700 text-[10px] uppercase tracking-widest">
        Whispers in the dark &bull; Siren v2.5
      </footer>
    </div>
  );
};

export default App;
