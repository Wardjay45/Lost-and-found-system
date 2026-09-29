import { useState, useEffect, useRef } from 'react';
const API_URL = 'http://localhost:3001/api';

export default function Messaging() {
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load conversation list
  const loadConversations = async () => {
    try {
      const res = await fetch(`${API_URL}/messages/conversations`);
      const data = await res.json();
      setConversations(data || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Auto-refresh conversation list every 5 seconds
  useEffect(() => {
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load messages for selected conversation
  const selectChat = async (conv) => {
    setSelectedChat(conv);
    try {
      const res = await fetch(`${API_URL}/messages/${conv.id}`);
      const msgs = await res.json();
      setMessages(msgs || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([]);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-refresh messages for selected chat
  useEffect(() => {
    if (!selectedChat) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/messages/${selectedChat.id}`);
        const msgs = await res.json();
        if (msgs && msgs.length !== messages.length) {
          setMessages(msgs);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedChat?.id, messages.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedChat) return;

    try {
      await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedChat.id,
          sender: 'admin',
          text: messageText.trim(),
        }),
      });

      const res = await fetch(`${API_URL}/messages/${selectedChat.id}`);
      const msgs = await res.json();
      setMessages(msgs || []);
      setMessageText('');
      loadConversations();
    } catch (err) {
      console.error('Send failed:', err);
    }
  };

  const getTime = (time) => {
    if (!time) return '';
    const d = new Date(time);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getLastMessageText = (conv) => {
    if (!conv.last_message) return 'No messages yet';
    return (conv.last_message.text || '').substring(0, 40);
  };

  const filteredChats = conversations.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messaging</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden h-full flex">
        {/* Sidebar - User List */}
        <div className="w-80 lg:w-96 border-r border-gray-100 dark:border-gray-700 flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <span className="absolute left-3 top-3 text-gray-400 text-sm">🔍</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-gray-400">Loading conversations...</div>
            ) : filteredChats.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                {searchQuery ? 'No users found' : (
                  <div className="space-y-1">
                    <p>No conversations yet</p>
                    <p className="text-xs">Wait for users to message you</p>
                  </div>
                )}
              </div>
            ) : (
              filteredChats.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => selectChat(conv)}
                  className={`w-full flex items-center gap-3 p-3.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors border-b border-gray-50 dark:border-gray-700/50 ${
                    selectedChat?.id === conv.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500' : ''
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                      {conv.avatar || conv.name.charAt(0).toUpperCase()}
                    </div>
                    {conv.last_message && conv.last_message.sender === 'user' && selectedChat?.id !== conv.id && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-800" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{conv.name}</p>
                      {conv.last_message && (
                        <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{getTime(conv.last_message.time)}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {getLastMessageText(conv)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        {selectedChat ? (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/80 flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                {selectedChat.avatar || selectedChat.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedChat.name}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  {messages.length} message{messages.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50 dark:bg-gray-800/30">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-4xl mb-2">💬</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      No messages with {selectedChat.name} yet
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender !== 'admin' && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mr-2 mt-1">
                        {selectedChat.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="max-w-[75%]">
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.sender === 'admin'
                          ? 'bg-indigo-600 text-white rounded-br-md'
                          : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-bl-md shadow-sm'
                      }`}>
                        <p>{msg.text}</p>
                      </div>
                      <p className={`text-[10px] mt-0.5 px-2 text-gray-400 ${msg.sender === 'admin' ? 'text-right' : 'text-left'}`}>
                        {getTime(msg.time)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={`Message ${selectedChat.name}...`}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50/30 dark:bg-gray-800/20">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Messages</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                Select a user from the sidebar to view their messages
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}