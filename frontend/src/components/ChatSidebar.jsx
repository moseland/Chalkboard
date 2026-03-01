import { useState, useRef, useEffect } from 'react';
import useChatStore from '../store/chatStore';
import { MessageCircle, X, Send, Sparkles, Settings } from 'lucide-react';

const MODELS = [
    { id: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Preview)' },
    { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)' },
    { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'google/gemma-3-4b-it:free', name: 'Gemma 3 4B (Free)' },
    { id: 'openai/gpt-5.2', name: 'GPT-5.2' },
    { id: 'openai/gpt-5.1', name: 'GPT-5.1' },
    { id: 'openai/gpt-5', name: 'GPT-5' },
    { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini' },
    { id: 'x-ai/grok-4', name: 'Grok 4' },
    { id: 'x-ai/grok-4.1-fast', name: 'Grok-4.1 Fast' },
    { id: 'x-ai/grok-3', name: 'Grok 3' },
    { id: 'x-ai/grok-3-mini', name: 'Grok-3 Mini' },
];

export default function ChatSidebar({ onSendMessage }) {
    const { messages, isOpen, toggleChat, aiActiveUntil, selectedModel, setSelectedModel } = useChatStore();
    const [inputValue, setInputValue] = useState('');
    const [isAiActive, setIsAiActive] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const messagesEndRef = useRef(null);

    // Track AI active status relative to now
    useEffect(() => {
        const checkActive = () => {
            // Backend sends unix timestamp in seconds
            const now = Date.now() / 1000;
            setIsAiActive(now < aiActiveUntil);
        };
        checkActive();
        const interval = setInterval(checkActive, 2000);
        return () => clearInterval(interval);
    }, [aiActiveUntil]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const text = inputValue.trim();
        if (text && onSendMessage) {
            // Include selected model in the message payload
            onSendMessage(text, selectedModel);
            setInputValue('');
        }
    };

    return (
        <>
            <button
                className={`tw-chat-toggle ${isOpen ? 'active' : ''}`}
                onClick={toggleChat}
                title="Toggle Chat"
            >
                <MessageCircle size={24} />
            </button>

            {isOpen && (
                <div className="tw-chat-bubble">
                    <div className="tw-chat-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <h3>Chat</h3>
                            {isAiActive && (
                                <div className="tw-ai-badge" title="Igor is listening to context">
                                    <Sparkles size={12} style={{ marginRight: '4px' }} />
                                    Active
                                </div>
                            )}
                        </div>
                        <div className="tw-chat-header-actions">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`tw-icon-btn ${showSettings ? 'active' : ''}`}
                                title="AI Settings"
                            >
                                <Settings size={18} />
                            </button>
                            <button onClick={toggleChat} className="tw-close-btn">
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {showSettings && (
                        <div className="tw-chat-settings-overlay">
                            <div className="tw-settings-header">
                                <span>AI Model</span>
                                <button onClick={() => setShowSettings(false)}><X size={14} /></button>
                            </div>
                            <div className="tw-model-list">
                                {MODELS.map(model => (
                                    <button
                                        key={model.id}
                                        className={`tw-model-item ${selectedModel === model.id ? 'selected' : ''}`}
                                        onClick={() => {
                                            setSelectedModel(model.id);
                                            setShowSettings(false);
                                        }}
                                    >
                                        <span className="tw-model-name">{model.name}</span>
                                        {selectedModel === model.id && <Sparkles size={12} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="tw-chat-messages">
                        {messages.length === 0 ? (
                            <div className="tw-chat-empty">No messages yet. Say hi!</div>
                        ) : (
                            messages.map((msg, idx) => (
                                <div key={idx} className={`tw-message ${msg.isSelf ? 'tw-message-self' : ''} ${msg.isAi ? 'tw-message-ai' : ''}`}>
                                    <div className="tw-message-author">{msg.authorName}</div>
                                    <div className="tw-message-text">{msg.text}</div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form className="tw-chat-input" onSubmit={handleSubmit}>
                        <input
                            type="text"
                            placeholder={isAiActive ? "Igor is listening..." : "Type a message... Use @igor to tag"}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                        />
                        <button type="submit">
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
