'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, Sparkles, X } from 'lucide-react'

type Role = 'user' | 'assistant'
interface Message {
  id: string
  role: Role
  text: string
}

const INTRO: Message = {
  id: 'intro',
  role: 'assistant',
  text: "Hi! Just tell me what you'd like to change. For example, \"move ACC2201 out of B2-004 on Mondays.\" I'll update the schedule for you.",
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([INTRO])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open, thinking])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function send() {
    const text = draft.trim()
    if (!text || thinking) return
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setDraft('')
    setThinking(true)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: "I'm not wired up to the solver yet — once I am, I'll apply this change and show you the updated schedule.",
        },
      ])
      setThinking(false)
    }, 700)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label="Open AI chat"
          onClick={() => setOpen(true)}
          className="chat-fab"
        >
          <MessageCircle size={20} />
        </button>
      )}

      {open && (
        <div className="chat-panel" role="dialog" aria-label="AI schedule assistant">
          <header className="chat-header">
            <div className="chat-title">
              <span className="chat-avatar">
                <Sparkles size={14} />
              </span>
              <div>
                <div className="chat-name">Schedule assistant</div>
                <div className="chat-subtitle">Ask for changes in plain language</div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
              className="btn btn-ghost btn-icon btn-sm"
            >
              <X size={14} />
            </button>
          </header>

          <div ref={scrollRef} className="chat-messages">
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble chat-bubble-${m.role}`}>
                {m.text}
              </div>
            ))}
            {thinking && (
              <div className="chat-bubble chat-bubble-assistant chat-typing">
                <span /><span /><span />
              </div>
            )}
          </div>

          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Describe a change…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
            />
            <button
              type="button"
              aria-label="Send"
              onClick={send}
              disabled={!draft.trim() || thinking}
              className="chat-send"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
