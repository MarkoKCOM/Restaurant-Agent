import { useState, useRef, useEffect } from "react";
import { useLang } from "../i18n.js";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const API = "/api/v1";

export function ChatWidget() {
  const { lang } = useLang();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("openseat-token") ?? ""}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed");
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: lang === "he" ? "שגיאה בתקשורת עם הבוט. נסה שוב." : "Error communicating with the bot. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const placeholder = lang === "he" ? "שאל שאלה..." : "Ask a question...";
  const title = lang === "he" ? "עזרה" : "Help";
  const dir = lang === "he" ? "rtl" : "ltr";

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-amber-600 text-white shadow-lg hover:bg-amber-700 transition-all flex items-center justify-center text-2xl"
        title={title}
      >
        {isOpen ? "\u2715" : "\u2753"}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 left-6 z-50 w-96 max-h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          dir={dir}
        >
          {/* Header */}
          <div className="bg-amber-600 text-white px-4 py-3 flex items-center gap-2">
            <span className="text-lg">&#x1F916;</span>
            <span className="font-semibold">OpenSeat {title}</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[350px]">
            {messages.length === 0 && (
              <p className="text-sm text-gray-400 text-center mt-8">
                {lang === "he" ? "שלום! איך אפשר לעזור?" : "Hi! How can I help?"}
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-amber-100 text-amber-900"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-500">
                  {lang === "he" ? "חושב..." : "Thinking..."}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-3 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={placeholder}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {lang === "he" ? "שלח" : "Send"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
