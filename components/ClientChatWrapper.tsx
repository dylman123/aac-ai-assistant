'use client';

import dynamic from 'next/dynamic';

// Create a simple loading component
const LoadingComponent = () => (
  <div className="min-h-screen p-4 max-w-2xl mx-auto flex items-center justify-center">
    <span className="inline-block animate-flutter">🐝</span>
  </div>
);

// Dynamically import the main component with SSR disabled
const ChatComponent = dynamic(
  () => import('./ChatComponent'),
  { 
    ssr: false,
    loading: () => <LoadingComponent />
  }
);

export default function ClientChatWrapper() {
  return <ChatComponent />;
} 