import { create } from 'zustand';

const useChatStore = create((set) => ({
    messages: [],
    isOpen: false,
    aiActiveUntil: 0,

    toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
    setChatOpen: (isOpen) => set({ isOpen }),
    aiActiveUntil: 0,
    selectedModel: 'google/gemini-2.5-flash',

    toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
    setChatOpen: (isOpen) => set({ isOpen }),
    setAiActiveUntil: (aiActiveUntil) => set({ aiActiveUntil }),
    setSelectedModel: (selectedModel) => set({ selectedModel }),

    addMessage: (message) => set((state) => {
        let newMessages = [...state.messages];
        if (message.removeIndicator) {
            newMessages = newMessages.filter(m => m.temporaryId !== message.removeIndicator);
        }
        return { messages: [...newMessages, message] };
    }),

    // Load history when joining a board
    setMessages: (messages) => set({ messages })
}));

export default useChatStore;
