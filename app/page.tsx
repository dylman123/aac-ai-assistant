'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  text: string;
  isUser: boolean;
}

export default function Home() {
  const [partnerInput, setPartnerInput] = useState('');
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  // Add debounce timeout ref
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Add effect to scroll to bottom whenever chat history changes
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [chatHistory, suggestions]);

  const getSuggestions = async (inputValue?: string) => {
    if (!inputValue?.trim() && !partnerInput.trim()) return;
    
    setLoading(true);

    // Only update partner input state if there was a message
    const newChatHistory = partnerInput.trim() 
      ? [...chatHistory, { text: partnerInput, isUser: false }]
      : chatHistory;

    if (partnerInput.trim()) {
      setChatHistory(newChatHistory);
      setPartnerInput('');
    }

    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userInput: inputValue,
          chatHistory: newChatHistory,
        }),
      });
      
      const data = await response.json();
      if (!Array.isArray(data.suggestions)) {
        throw new Error(`Invalid suggestions: ${data.suggestions}`);
      }
      setSuggestions(data.suggestions as string[]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    setChatHistory([...chatHistory, { text: suggestion, isUser: true }]);
    setSuggestions([]);
    setUserInput('');
  };

  const handleUserInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setUserInput(newValue);
    
    // Clear any existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Set new timeout
    debounceTimeout.current = setTimeout(() => {
      getSuggestions(newValue);
    }, 300); // 300ms debounce
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  const handleSendMessage = () => {
    if (!userInput.trim()) return;
    setChatHistory([...chatHistory, { text: userInput, isUser: true }]);
    setUserInput('');
    setSuggestions([]);
  };

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">AAC Assistant</h1>
      
      {/* Conversation Partner's Input Area */}
      <div className="bg-green-50 p-4 rounded-lg mb-4">
        <div className="text-sm text-green-700 font-semibold mb-2">Conversation Partner's Input</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={partnerInput}
            onChange={(e) => setPartnerInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && getSuggestions()}
            placeholder="Type your message..."
            className="flex-1 p-2 border border-green-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-green-300 focus:border-green-300"
            disabled={loading}
          />
          <button
            onClick={() => getSuggestions()}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : 'Send'}
          </button>
        </div>
      </div>
      
      {/* Shared Chat History */}
      <div 
        ref={chatWindowRef}
        className="mb-4 border rounded-lg p-4 h-[400px] overflow-y-auto bg-gray-50"
      >
        <div className="text-sm text-gray-500 font-semibold mb-2 text-center sticky -top-4 bg-gray-50">
          Conversation History
        </div>
        
        {chatHistory.map((message, index) => (
          <div
            key={index}
            className={`mb-2 p-2 rounded-lg ${
              message.isUser
                ? 'bg-blue-500 text-white ml-auto max-w-[80%]'
                : 'bg-green-500 text-white mr-auto max-w-[80%]'
            }`}
          >
            {message.text}
          </div>
        ))}

        {/* Suggestions appear at the bottom of chat history */}
        {suggestions.length > 0 && (
          <div className="flex flex-col gap-2 mt-4">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => selectSuggestion(suggestion)}
                className="ml-auto p-2 rounded-lg bg-blue-100 text-blue-900 
                         hover:bg-blue-200 transition-colors duration-200
                         text-left max-w-[80%] cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Combined User Input Area */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="text-sm text-blue-700 font-semibold mb-2">Your Message</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={userInput}
            onChange={handleUserInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type to see suggestions..."
            className="flex-1 p-2 border border-blue-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
          />
          <button
            onClick={handleSendMessage}
            disabled={!userInput.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg 
                     hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed
                     transition-colors duration-200"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
