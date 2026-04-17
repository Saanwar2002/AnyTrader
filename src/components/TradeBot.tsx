import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, X, Send, Loader2, User, Sparkles } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface Message {
  role: "user" | "model";
  text: string;
}

interface TradeBotProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TradeBot({ isOpen, onClose }: TradeBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "model", text: "Hello! I'm AnyTrader Bot. I can help you with UK pricing advice, trade recommendations, and job planning. What's on your mind?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: userMessage,
          model: "gemini-1.5-flash",
          config: {
            systemInstruction: `You are AnyTrader Bot, an expert assistant for the AnyTrader platform. Your goal is to provide homeowners with instant UK pricing advice, help them understand trade categories, and give tips on job planning. Be helpful, professional, and use UK English. If asked about prices, provide typical ranges based on current UK market rates. Always remind users that these are estimates and they should get multiple quotes.
      
      Additionally, you are plugged into the AnyTrader AI Smart Shop. If a user asks about tools, equipment, or workwear needed for a job or trade, gently mention they can use the "AI Smart Shop" icon in the top right to get curated recommendations for their specific trade and category.`
          }
        })
      });

      if (!response.ok) throw new Error("AI Proxy failed");
      const data = await response.json();

      const modelText = data.text || "I'm sorry, I couldn't process that. Please try again.";
      setMessages(prev => [...prev, { role: "model", text: modelText }]);
    } catch (error) {
      console.error("TradeBot Error:", error);
      setMessages(prev => [...prev, { role: "model", text: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[600px]"
        >
          {/* Header */}
          <div className="bg-blue-600 p-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold">TradeBot</h2>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-[10px] font-medium text-blue-100 uppercase tracking-wider">AI Assistant Online</span>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg, i) => (
              <div 
                key={i}
                className={cn(
                  "flex gap-3 max-w-[85%]",
                  msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  msg.role === "user" ? "bg-blue-100 text-blue-600" : "bg-white border border-slate-200 text-slate-400"
                )}>
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={cn(
                  "p-3 rounded-2xl text-sm leading-relaxed",
                  msg.role === "user" ? "bg-blue-600 text-white rounded-tr-none" : "bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm"
                )}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 max-w-[85%] mr-auto">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-slate-100">
            <div className="relative">
              <input 
                type="text"
                placeholder="Ask about pricing, trades, or jobs..."
                className="w-full pl-4 pr-12 py-3 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 focus:bg-white transition-all text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              Powered by AnyTrader AI
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
