'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Wrench,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Server,
  RefreshCw,
} from 'lucide-react';

interface ToolLog {
  id: string;
  name: string;
  status: 'waiting' | 'success' | 'failed';
  resultSummary: string;
  timestamp: string;
  durationMs?: number;
}

interface BookingCardData {
  bookingId: string;
  customerName: string;
  phone: string;
  service: string;
  address: string;
  preferredTime: string;
  status: string;
  source: string;
}

interface ConfirmationCardData {
  title: string;
  details: Array<{ label: string; value: string }>;
  pendingAction: any;
}

interface Message {
  id: string;
  sender: 'user' | 'alexa';
  text: string;
  timestamp: string;
  isFallback?: boolean;
  confirmationCard?: ConfirmationCardData;
  bookingCard?: BookingCardData;
}

export default function AlexaPlusOneWayFixPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'alexa',
      text: "Hello! I am Alexa+ powered by Amazon Bedrock Nova & OneWayFix MCP tools. I can answer home-repair questions like an experienced technician, or help you book, check, and manage services. How can I help you today?",
      timestamp: '10:00 AM',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toolLogs, setToolLogs] = useState<ToolLog[]>([
    {
      id: 'init-log',
      name: 'initialize',
      status: 'success',
      resultSummary: 'Connected to Streamable HTTP MCP server @ /mcp',
      timestamp: '10:00 AM',
      durationMs: 12,
    },
  ]);

  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        setIsSpeechSupported(true);
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = false;
        recog.lang = 'en-US';

        recog.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInputText(transcript);
            handleSendMessage(transcript);
          }
        };

        recog.onend = () => setIsListening(false);
        recog.onerror = () => setIsListening(false);
        recognitionRef.current = recog;
      }
    }
  }, []);

  const speakText = (text: string) => {
    if (!speechEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          messages: newMessages.map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: [{ text: m.text }],
          })),
        }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (data.toolLogs && Array.isArray(data.toolLogs)) {
        setToolLogs((prev) => [...data.toolLogs, ...prev]);
      }

      const alexaMsgId = `alexa-${Date.now()}`;
      const alexaMsg: Message = {
        id: alexaMsgId,
        sender: 'alexa',
        text: data.text || 'Done!',
        isFallback: data.isFallback,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confirmationCard: data.confirmationCard,
        bookingCard: data.bookingCard,
      };

      setMessages((prev) => [...prev, alexaMsg]);
      speakText(alexaMsg.text);
    } catch (_err) {
      setIsLoading(false);
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'alexa',
        text: 'Sorry, I encountered a communication error with the backend agent service.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const handleConfirmationAction = async (action: 'confirm' | 'cancel', pendingAction: any) => {
    if (isLoading) return;
    setIsLoading(true);

    const userMsg: Message = {
      id: `user-confirm-${Date.now()}`,
      sender: 'user',
      text: action === 'confirm' ? 'Yes, I confirm this booking.' : 'No, cancel this request.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationResponse: { action, pendingAction },
        }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (data.toolLogs && Array.isArray(data.toolLogs)) {
        setToolLogs((prev) => [...data.toolLogs, ...prev]);
      }

      const alexaMsg: Message = {
        id: `alexa-resp-${Date.now()}`,
        sender: 'alexa',
        text: data.text || (action === 'confirm' ? 'Booking submitted successfully!' : 'Cancelled.'),
        isFallback: data.isFallback,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        bookingCard: data.bookingCard,
      };

      setMessages((prev) => [...prev, alexaMsg]);
      speakText(alexaMsg.text);
    } catch (_err) {
      setIsLoading(false);
    }
  };

  const quickChips = [
    'What services do you offer?',
    'Why is my AC not cooling?',
    'Book a washing machine repair for tomorrow',
    'Check my booking status',
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* 1. App Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-base text-slate-100 flex items-center gap-2">
                ActionOS · Alexa+ for OneWayFix
              </h1>
              <p className="text-xs text-slate-400">Bedrock Nova Agent & MCP Standard Tools</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSpeechEnabled(!speechEnabled)}
              title={speechEnabled ? 'Mute Speech Output' : 'Unmute Speech Output'}
              className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border border-slate-700/50"
            >
              {speechEnabled ? <Volume2 className="w-5 h-5 text-cyan-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
            </button>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Mock Mode (ONEWAYFIX_MOCK=true)
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Content Grid */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 flex flex-col md:flex-row gap-6">
        {/* Left Column: Voice & Chat Interface */}
        <section className="flex-1 flex flex-col glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
          {/* Messages Area */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 max-h-[600px] min-h-[420px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'alexa' && (
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0 mt-1">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div className="max-w-[85%] md:max-w-[75%] space-y-3">
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-cyan-600 text-white rounded-br-none shadow-md shadow-cyan-600/20'
                        : 'bg-slate-900/90 text-slate-100 border border-slate-800 rounded-bl-none shadow-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/40 text-[10px] text-slate-400">
                      {msg.isFallback && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium">
                          Fallback mode (Local rules)
                        </span>
                      )}
                      <span suppressHydrationWarning className="ml-auto opacity-70">
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>

                  {/* Confirmation Card */}
                  {msg.confirmationCard && (
                    <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-3 shadow-lg backdrop-blur-md">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                        <ShieldAlert className="w-5 h-5" />
                        <span>{msg.confirmationCard.title}</span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                        {msg.confirmationCard.details.map((d, i) => (
                          <div key={i} className="flex justify-between py-1 border-b border-slate-800/60 last:border-0">
                            <span className="text-slate-400">{d.label}:</span>
                            <span className="font-medium text-slate-100">{d.value}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={() => handleConfirmationAction('confirm', msg.confirmationCard?.pendingAction)}
                          disabled={isLoading}
                          className="flex-1 py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Confirm & Book
                        </button>
                        <button
                          onClick={() => handleConfirmationAction('cancel', msg.confirmationCard?.pendingAction)}
                          disabled={isLoading}
                          className="py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-all border border-slate-700"
                        >
                          <XCircle className="w-4 h-4 text-slate-400" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Booking Result Card */}
                  {msg.bookingCard && (
                    <div className="p-4 rounded-xl bg-slate-900 border border-cyan-500/30 space-y-3 shadow-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
                          <Wrench className="w-5 h-5" />
                          <span>OneWayFix Booking Details</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {msg.bookingCard.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                        <div>
                          <span className="text-slate-400 block text-[10px]">BOOKING ID</span>
                          <span className="font-mono text-cyan-300 font-semibold">{msg.bookingCard.bookingId}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">SERVICE</span>
                          <span className="font-medium text-slate-200">{msg.bookingCard.service}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">CUSTOMER</span>
                          <span className="text-slate-300">{msg.bookingCard.customerName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">TIME</span>
                          <span className="text-slate-300">{msg.bookingCard.preferredTime}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 block text-[10px]">SERVICE ADDRESS</span>
                          <span className="text-slate-300 font-mono text-[11px]">{msg.bookingCard.address}</span>
                        </div>
                      </div>

                      <a
                        href="https://onewayfix.com"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors pt-1"
                      >
                        Manage booking on OneWayFix.com <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2 px-3 rounded-lg bg-slate-900/50 w-fit border border-slate-800">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Alexa+ is executing Bedrock Converse loop & MCP tools...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick-Start Intent Chips */}
          <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-900/40 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] text-slate-400 font-medium flex-shrink-0 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Quick-start:
            </span>
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                disabled={isLoading}
                className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium border border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 transition-all flex-shrink-0 bg-slate-950/60"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input & Mic Controls */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              {isSpeechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  title={isListening ? 'Stop Listening' : 'Speak Voice Command'}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all border ${
                    isListening
                      ? 'bg-rose-600 text-white border-rose-500 animate-pulse shadow-lg shadow-rose-600/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-cyan-400" />}
                </button>
              )}

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask Alexa+ to book a repair, check status, or list services..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 h-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white transition-all shadow-md shadow-cyan-600/20"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </section>

        {/* Right Column: MCP Live Audit Panel */}
        <aside className="w-full md:w-80 glass-panel rounded-2xl border border-slate-800 p-4 flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-cyan-400" />
              <h2 className="font-semibold text-sm text-slate-200">What Alexa+ did</h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
              MCP STREAM
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[520px]">
            {toolLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs shadow-sm hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-cyan-300 font-medium text-[11px] flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-cyan-400" /> {log.name}
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      log.status === 'success'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : log.status === 'waiting'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>

                <p className="text-slate-300 text-[11px] leading-snug">{log.resultSummary}</p>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/40">
                  <span suppressHydrationWarning className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" /> {log.timestamp}
                  </span>
                  {log.durationMs !== undefined && <span>{log.durationMs}ms</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Audit Standard: MCP 2025-11-25</span>
            <span className="text-cyan-400 font-medium">Streamable HTTP</span>
          </div>
        </aside>
      </main>

      {/* Footer Disclaimer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-3 text-center text-xs text-slate-500">
        Demo data. Sandbox backend modeled on OneWayFix.
      </footer>
    </div>
  );
}
