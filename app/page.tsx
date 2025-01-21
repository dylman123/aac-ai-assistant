'use client';

import { useState } from 'react';

interface ChatMessage {
  text: string;
  isUser: boolean;
}

export default function Home() {
  const [partnerInput, setPartnerInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const getSuggestions = async (input: string) => {
    if (!input.trim() && !partnerInput.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          partnerInput,
          userInput: input,
          chatHistory 
        }),
      });
      
      const data = await response.json();
      setSuggestions(data.suggestions);
      
      // Only add partner input to history when they submit
      if (partnerInput.trim()) {
        setChatHistory([...chatHistory, { text: partnerInput, isUser: true }]);
        setPartnerInput('');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    setChatHistory([...chatHistory, { text: suggestion, isUser: false }]);
    setSuggestions([]);
    setUserInput('');
  };

  const handleUserInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setUserInput(newValue);
    getSuggestions(newValue);
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
            onKeyDown={(e) => e.key === 'Enter' && getSuggestions(userInput)}
            placeholder="Type your message..."
            className="flex-1 p-2 border border-green-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-green-300 focus:border-green-300"
            disabled={loading}
          />
          <button
            onClick={() => getSuggestions(userInput)}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : 'Send'}
          </button>
        </div>
      </div>
      
      {/* Shared Chat History */}
      <div className="mb-4 border rounded-lg p-4 h-[400px] overflow-y-auto bg-gray-50">
        <div className="text-sm text-gray-500 font-semibold mb-2 text-center sticky -top-4 bg-gray-50">Conversation History</div>
        {chatHistory.map((message, index) => (
          <div
            key={index}
            className={`mb-2 p-2 rounded-lg ${
              message.isUser
                ? 'bg-green-500 text-white mr-auto max-w-[80%]'
                : 'bg-blue-500 text-white ml-auto max-w-[80%]'
            }`}
          >
            {message.text}
          </div>
        ))}
      </div>

      {/* Combined User Input and Suggestions Area */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="text-sm text-blue-700 font-semibold mb-2">Your Message</div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={handleUserInputChange}
              placeholder="Type to see suggestions..."
              className="flex-1 p-2 border border-blue-200 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
            />
          </div>
          {suggestions.length > 0 && (
            <div className="space-y-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => selectSuggestion(suggestion)}
                  className="w-full p-2 text-left border border-blue-200 rounded-lg 
                           bg-white text-gray-700 hover:bg-blue-100 
                           transition-colors duration-200
                           focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
