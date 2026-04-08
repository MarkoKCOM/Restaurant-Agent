import { useState, useRef, useEffect } from "react";
import { useLang } from "../i18n.js";
import { Tooltip } from "./Tooltip.js";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const API = "/api/v1";

export function ChatWidget() {
  const { lang, t } = useLang();
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
          Authorization: `Bearer ${localStorage.getItem("openseat_token") ?? ""}`,
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
        { role: "assistant", content: t.chat.error },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const placeholder = lang === "he" ? "שאל שאלה..." : "Ask a question...";
  const dir = lang === "he" ? "rtl" : "ltr";
  const buttonSide = lang === "he" ? "left-4 md:left-6" : "right-4 md:right-6";
  const panelSide = lang === "he" ? "left-4 md:left-6" : "right-4 md:right-6";
  const panelTitle = t.chat.title;
  const panelSubtitle = t.chat.subtitle;
  const openLabel = t.chat.open;
  const closeLabel = t.chat.close;

  return (
    <>
      {/* Floating button */}
      <Tooltip content={isOpen ? closeLabel : openLabel} className={`fixed bottom-4 md:bottom-6 ${buttonSide} z-50`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-11 w-11 items-center justify-center gap-2 rounded-full bg-amber-600 px-3 text-white shadow-md ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-300 md:h-10 md:w-auto"
          title={isOpen ? closeLabel : openLabel}
          aria-label={isOpen ? closeLabel : openLabel}
        >
          {isOpen ? (
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m-6 6l-3 2V6a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H9l-2 2z" />
            </svg>
          )}
          <span className="hidden text-sm font-medium md:inline">{isOpen ? closeLabel : openLabel}</span>
        </button>
      </Tooltip>

      {/* Chat panel */}
      {isOpen && (
        <div
          className={`fixed bottom-[4.5rem] md:bottom-20 ${panelSide} z-50 flex max-h-[26rem] w-[min(21rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl`}
          dir={dir}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 bg-amber-600 px-4 py-2.5 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-base">🤖</span>
              <div>
                <div className="font-semibold leading-tight">{panelTitle}</div>
                <div className="text-xs text-amber-50/90">{panelSubtitle}</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              title={closeLabel}
              aria-label={closeLabel}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="min-h-[160px] max-h-[280px] flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-sm text-gray-400 text-center mt-8">
                {t.chat.emptyState}
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
                  {t.chat.thinking}
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
              placeholder={t.chat.placeholder || placeholder}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
              title={t.chat.send}
              aria-label={t.chat.send}
            >
              {t.chat.send}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
