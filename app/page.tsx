'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  text: string;
  isUser: boolean;
}

export default function Home() {
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  // Add debounce timeout ref
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Add new state for voice selection
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Add effect to scroll to bottom whenever chat history changes
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [chatHistory, suggestions]);

  // Add useEffect to load voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      // Set default voice (preferably an English one)
      const defaultVoice = availableVoices.find(voice => voice.lang.startsWith('en')) || availableVoices[0];
      setSelectedVoice(defaultVoice);
    };

    // Load voices immediately if available
    loadVoices();
    
    // Chrome loads voices asynchronously, so we need this
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const getSuggestions = async ({newUserInput, newPartnerInput}: {newUserInput?: string, newPartnerInput?: string}) => {
    if (!newUserInput?.trim() && !newPartnerInput?.trim()) return;
    setLoading(true);

    // Only update partner input state if there was a message
    const newChatHistory = newPartnerInput?.trim() 
      ? [...chatHistory, { text: newPartnerInput, isUser: false }]
      : chatHistory;

    if (newPartnerInput?.trim()) {
      setChatHistory(newChatHistory);
    }

    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInput: newUserInput,
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
    const utterance = new SpeechSynthesisUtterance(suggestion);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);

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
      getSuggestions({newUserInput: newValue});
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

  const startRecording = async () => {
    try {
      setPermissionError(null); // Clear any previous errors

      // First check if getUserMedia is supported
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Audio recording is not supported in this browser');
      }

      // Get supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/mp4';

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false
      });
      
      const mediaRecorder = new MediaRecorder(stream, {mimeType});
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (error: unknown) {
      console.error('Error accessing microphone:', error);
      if (error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) {
        setPermissionError('Please allow microphone access to record audio');
      } else if (error instanceof Error && error.name === 'NotFoundError') {
        setPermissionError('No microphone found. Please connect a microphone and try again');
      } else {
        setPermissionError(error instanceof Error ? error.message : 'Failed to start recording');
      }
    } finally {
      setLoading(false);
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    
    // Stop all tracks
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());

    // Process the audio after stopping
    if (audioChunksRef.current.length === 0) return;

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.mp3');

    setLoading(true);
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });      
      const data = await response.json();
      if (data.text) {
        getSuggestions({newPartnerInput: data.text});
      }
    } catch (error) {
      console.error('Transcription error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputBlur = () => {
    window.scrollTo(0, 0);
  };

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-8 text-center">Smart AAC Assistant</h1>
      
      {/* Conversation Partner's Audio Input */}
      <div className="mb-4 flex flex-col items-center gap-2">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={loading}
          className={`px-6 py-3 rounded-full flex items-center gap-2 transition-colors duration-200 ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-green-500 hover:bg-green-600 text-white'
          } disabled:bg-gray-400 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <span className="animate-spin">⏳</span>
          ) : isRecording ? (
            <>
              <span className="animate-pulse">●</span> Stop Listening
            </>
          ) : (
            <>
              <span>👂</span> Start Listening
            </>
          )}
        </button>
        {permissionError && (
          <div className="text-red-500 text-sm text-center mt-2">
            {permissionError}
          </div>
        )}
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
              <div key={index} className="ml-auto flex items-center gap-2 justify-end">
                <div className="text-3xl text-blue-700 font-semibold mb-2">
                  {index === 0 ? '😊' : index === 1 ? '😐' : '😞'}
                </div>
                <button
                  key={index}
                  onClick={() => selectSuggestion(suggestion)}
                  className="ml-4 p-2 rounded-lg bg-blue-100 text-blue-900 
                         hover:bg-blue-200 transition-colors duration-200
                         text-left max-w-[80%] cursor-pointer"
              >
                {suggestion}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Combined User Input Area with Voice Settings */}
      <div className="bg-blue-50 p-4 rounded-lg mb-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={userInput}
            onChange={handleUserInputChange}
            onBlur={handleInputBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type to modify suggestions..."
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

      {/* Voice Settings */}
      <div className="flex justify-end items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <label className="whitespace-nowrap text-gray-700 dark:text-gray-200">
            Voice:
          </label>
          <select
            value={selectedVoice?.voiceURI || ''}
            onChange={(e) => {
              const voice = voices.find(v => v.voiceURI === e.target.value);
              setSelectedVoice(voice || null);
            }}
            className="p-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-300 focus:border-blue-300"
          >
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {`${voice.name} (${voice.lang})`}
              </option>
            ))}
          </select>
        </div>
    </main>
  );
}
