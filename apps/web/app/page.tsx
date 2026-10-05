'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Plus,
  Compass,
  Wrench,
  Sparkles,
  MapPin,
  Calendar,
  DollarSign,
  Navigation,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Settings,
  User,
  MessageSquare,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Cpu,
  Server,
  X,
  CheckCircle2,
  AlertCircle,
  Menu,
} from 'lucide-react';

interface ToolLog {
  id: string;
  name: string;
  status: 'waiting' | 'success' | 'failed';
  resultSummary: string;
  timestamp: string;
  durationMs?: number;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isFallback?: boolean;
  toolLogs?: ToolLog[];
  confirmationCard?: any;
  bookingCard?: any;
  travelCard?: any;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
  messages: Message[];
}

export default function ActionOSPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Settings & Profile State
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  // Config State
  const [modelProvider, setModelProvider] = useState('gemini');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  // User Profile State
  const [userProfile, setUserProfile] = useState({
    name: 'Priya Verma',
    city: 'Hyderabad',
    travelPreference: 'Heritage & Food',
    budgetStyle: 'Moderate',
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech & Sessions
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
          setInputText(transcript);
          setIsListening(false);
          handleSendMessage(transcript);
        };

        recog.onerror = () => setIsListening(false);
        recog.onend = () => setIsListening(false);

        recognitionRef.current = recog;
      }
    }

    // Load initial session
    const defaultId = `session-${Date.now()}`;
    const initialSession: ChatSession = {
      id: defaultId,
      title: 'New Chat',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      messages: [],
    };
    setSessions([initialSession]);
    setActiveSessionId(defaultId);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const speakText = (text: string) => {
    if (!speechEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/[*_#`🌐🔍✅⚠️📍✈️🛠🍽🛵🛒💬]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .slice(0, 300);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (_e) {
        setIsListening(false);
      }
    }
  };

  const createNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setMessages([]);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleSendMessage = async (textToSend?: string, confirmationResponse?: any) => {
    const prompt = (textToSend || inputText).trim();
    if (!prompt && !confirmationResponse) return;

    if (!confirmationResponse) {
      setInputText('');
    }

    const userMsgId = `user-${Date.now()}`;
    const updatedMessages: Message[] = confirmationResponse
      ? [...messages]
      : [
          ...messages,
          {
            id: userMsgId,
            sender: 'user',
            text: prompt,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ];

    setMessages(updatedMessages);
    setIsLoading(true);

    // Update session title on first message
    if (updatedMessages.length === 1 && !confirmationResponse) {
      const title = prompt.length > 28 ? `${prompt.slice(0, 28)}...` : prompt;
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, title } : s))
      );
    }

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: confirmationResponse ? undefined : prompt,
          messages: updatedMessages.map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
          sessionId: activeSessionId,
          userId: 'user-default',
          confirmationResponse,
          modelProvider,
        }),
      });

      const data = await response.json();

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: data.text || 'I have completed your request.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isFallback: data.isFallback,
        toolLogs: data.toolLogs || [],
        confirmationCard: data.confirmationCard,
        bookingCard: data.bookingCard,
        travelCard: data.travelCard,
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, messages: finalMessages } : s))
      );

      if (speechEnabled) {
        speakText(data.text);
      }
    } catch (_err) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: '⚠️ I encountered an error connecting to ActionOS services. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickChipClick = (query: string) => {
    setInputText(query);
    handleSendMessage(query);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* 1. Left Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 bg-slate-900 border-r border-slate-800/80 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand & New Chat */}
        <div className="p-4 border-b border-slate-800/80 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Sparkles className="w-5 h-5 text-slate-950 font-bold" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  ActionOS
                </h1>
                <p className="text-[10px] text-cyan-400/90 font-medium">AI Agent & MCP Workflows</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1.5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-all shadow-md shadow-cyan-500/10 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            New Agent Chat
          </button>
        </div>

        {/* Navigation / Recent Chats */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Recent Conversations
          </div>

          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveSessionId(s.id);
                setMessages(s.messages);
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              className={`w-full text-left py-2.5 px-3 rounded-lg flex items-center gap-2.5 text-sm transition-colors ${
                s.id === activeSessionId
                  ? 'bg-slate-800/90 text-cyan-300 font-medium border border-cyan-500/20'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="truncate flex-1">{s.title}</span>
            </button>
          ))}
        </div>

        {/* User Profile & Settings Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/50 flex items-center justify-between">
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-cyan-400">
              PV
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">{userProfile.name}</div>
              <div className="text-[10px] text-slate-500">{userProfile.city}</div>
            </div>
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="ActionOS Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 md:hidden backdrop-blur-sm"
        />
      )}

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-950">
        {/* Top Header */}
        <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 text-slate-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              ActionOS Assistant
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {modelProvider.toUpperCase()}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSpeechEnabled(!speechEnabled)}
              className={`p-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
                speechEnabled ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{speechEnabled ? 'Audio On' : 'Audio Off'}</span>
            </button>
          </div>
        </header>

        {/* Message / Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-4xl mx-auto w-full">
          {messages.length === 0 ? (
            /* Welcome / Category Screen */
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 space-y-8">
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-cyan-500/20">
                  <Sparkles className="w-9 h-9 text-slate-950" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  How can ActionOS help you today?
                </h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Plan trips, explore destinations, manage home repair services, and execute multi-step AI agent workflows.
                </p>
              </div>

              {/* Category Chips Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-2xl text-left">
                <button
                  onClick={() => handleQuickChipClick('Plan a 3 day trip to Hyderabad under ₹10,000')}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
                      <Compass className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-200">Plan a Trip</div>
                      <div className="text-xs text-slate-400">3-day Hyderabad travel itinerary & budget</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleQuickChipClick('Find top attractions and places near Charminar')}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-200">Explore Places</div>
                      <div className="text-xs text-slate-400">Attractions, heritage sites & landmarks</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleQuickChipClick('Book an AC Repair for tomorrow at 10 AM')}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-200">OneWayFix Services</div>
                      <div className="text-xs text-slate-400">Book AC repair, plumbing & appliance fixes</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleQuickChipClick('Explain what Model Context Protocol (MCP) is')}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-slate-950 transition-colors">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-200">General Questions</div>
                      <div className="text-xs text-slate-400">AI tech, coding, math & technology</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            /* Chat Messages Stream */
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-3xl rounded-2xl p-4 sm:p-5 text-sm sm:text-base shadow-sm ${
                    m.sender === 'user'
                      ? 'bg-cyan-600 text-white rounded-br-none'
                      : 'bg-slate-900 text-slate-100 border border-slate-800/80 rounded-bl-none'
                  }`}
                >
                  {/* Message Content */}
                  <div className="whitespace-pre-wrap leading-relaxed space-y-2">
                    {m.text}
                  </div>

                  {/* Inline Tool Execution Logs (Collapsible Step Indicator) */}
                  {m.toolLogs && m.toolLogs.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800">
                      <button
                        onClick={() =>
                          setExpandedLogs((prev) => ({
                            ...prev,
                            [m.id]: !prev[m.id],
                          }))
                        }
                        className="flex items-center gap-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        <span>
                          {m.toolLogs.length} Agent Tool Action{m.toolLogs.length > 1 ? 's' : ''} Executed
                        </span>
                        {expandedLogs[m.id] ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {expandedLogs[m.id] && (
                        <div className="mt-2 space-y-1.5 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                          {m.toolLogs.map((log) => (
                            <div key={log.id} className="flex items-center justify-between text-slate-300">
                              <span className="font-mono text-cyan-300">⚡ {log.name}</span>
                              <span className="text-slate-500 text-[10px]">
                                {log.status} ({log.durationMs || 10}ms)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Medium Risk Confirmation Card */}
                  {m.confirmationCard && (
                    <div className="mt-4 p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200">
                      <div className="flex items-center gap-2 font-bold text-amber-400 mb-2">
                        <ShieldAlert className="w-5 h-5" />
                        <span>{m.confirmationCard.title}</span>
                      </div>
                      <div className="space-y-1.5 text-xs mb-4">
                        {m.confirmationCard.details.map((d: any, idx: number) => (
                          <div key={idx} className="flex justify-between border-b border-amber-500/10 py-1">
                            <span className="text-amber-300/80">{d.label}:</span>
                            <span className="font-semibold text-amber-100">{d.value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleSendMessage(undefined, {
                              action: 'confirm',
                              pendingAction: m.confirmationCard.pendingAction,
                            })
                          }
                          className="flex-1 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Confirm & Submit
                        </button>
                        <button
                          onClick={() =>
                            handleSendMessage(undefined, {
                              action: 'cancel',
                              pendingAction: m.confirmationCard.pendingAction,
                            })
                          }
                          className="py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-500 mt-1 px-1">{m.timestamp}</span>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-3 text-cyan-400 text-xs font-medium bg-slate-900/60 p-3 rounded-xl border border-slate-800 w-fit">
              <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span>ActionOS Agent reasoning and executing MCP tools...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Controls Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            {isSpeechSupported && (
              <button
                onClick={toggleVoiceInput}
                className={`p-3 rounded-xl transition-all ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-slate-900 text-slate-400 hover:text-cyan-400 hover:bg-slate-800'
                }`}
                title="Voice Input (Speech-to-Text)"
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Ask ActionOS anything (e.g. 'Plan a 3 day trip to Hyderabad', 'Book AC repair')..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-all"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
              className="p-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 font-bold transition-all shadow-md shadow-cyan-500/20"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </main>

      {/* 3. Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyan-400" /> ActionOS Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* AI Model Provider */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">AI Model Provider</label>
                <select
                  value={modelProvider}
                  onChange={(e) => setModelProvider(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                >
                  <option value="gemini">Google Gemini (Default)</option>
                  <option value="ollama">Ollama (Local LLM)</option>
                  <option value="bedrock">Amazon Bedrock (Optional Historical)</option>
                </select>
              </div>

              {/* Gemini Model */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Gemini Model</label>
                <input
                  type="text"
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-mono text-xs"
                />
              </div>

              {/* Connected MCP Servers */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-cyan-400" /> Connected MCP Servers
                </label>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-mono text-slate-200">onewayfix</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">Connected</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-mono text-slate-200">web-search</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">Connected</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-mono text-slate-200">travel</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">Connected</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-sm transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* 4. Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-400" /> User Profile & Preferences
              </h3>
              <button onClick={() => setShowProfile(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Full Name</label>
                <input
                  type="text"
                  value={userProfile.name}
                  onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Home City</label>
                <input
                  type="text"
                  value={userProfile.city}
                  onChange={(e) => setUserProfile({ ...userProfile, city: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Travel Interest</label>
                <input
                  type="text"
                  value={userProfile.travelPreference}
                  onChange={(e) => setUserProfile({ ...userProfile, travelPreference: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                />
              </div>
            </div>

            <button
              onClick={() => setShowProfile(false)}
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-sm transition-colors"
            >
              Save Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
