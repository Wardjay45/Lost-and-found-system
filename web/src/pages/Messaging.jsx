import useMarkVisibleRead from '../hooks/useMarkVisibleRead';
import { incomingMessages } from '../../../shared/notifications.mjs';
import useNotifications from '../hooks/useNotifications';
import useLiveRefresh from '../hooks/useLiveRefresh';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import request from '../services/api';
import { PageHeader, EmptyState, LoadingState, ErrorState } from '../components/common/UI';
import AppIcon from '../components/common/AppIcon';
export default function Messaging() {
  const { conversationUnread } = useNotifications();
  const [conversations,setConversations]=useState([]), [selectedChat,setSelectedChat]=useState(null), [messages,setMessages]=useState([]);
  const [messageText,setMessageText]=useState(''), [loading,setLoading]=useState(true), [searchQuery,setSearchQuery]=useState('');
  const [error,setError]=useState(''), [chatError,setChatError]=useState(''), [chatLoading,setChatLoading]=useState(false), [sending,setSending]=useState(false);
  const messagesEndRef=useRef(null), selectedId=useRef(null), sendLock=useRef(false), messageVersion=useRef(0);
  const loadConversations=useCallback(async()=>{ try { const data=await request('/messages/conversations');setConversations(Array.isArray(data)?data:[]);setError(''); }catch(err){setError(err.message);}finally{setLoading(false);}},[]);
  useEffect(()=>{loadConversations();const timer=setInterval(loadConversations,5000);return()=>clearInterval(timer);},[loadConversations]);
  const loadMessages=useCallback(async id=>{ const version=++messageVersion.current; try {const data=await request('/messages/'+encodeURIComponent(id));if(selectedId.current===id && version===messageVersion.current){setMessages(Array.isArray(data)?data:[]);setChatError('');}}catch(err){if(selectedId.current===id && version===messageVersion.current)setChatError(err.message);}finally{if(selectedId.current===id && version===messageVersion.current)setChatLoading(false);}},[]);
  const displayedMessages = useMemo(() => selectedChat && !chatLoading && !chatError ? incomingMessages(messages, 'user', selectedChat.id) : [], [selectedChat, chatLoading, chatError, messages]);
  useMarkVisibleRead('messages', displayedMessages);
  useLiveRefresh('messages', () => { loadConversations(); if (selectedId.current != null) loadMessages(selectedId.current); });
  useLiveRefresh('conversations', loadConversations);
  const selectChat=conv=>{selectedId.current=conv.id;setSelectedChat(conv);setMessages([]);setMessageText('');setChatError('');setChatLoading(true);loadMessages(conv.id);};
  useEffect(()=>{if(!selectedChat)return;const timer=setInterval(()=>loadMessages(selectedChat.id),3000);return()=>clearInterval(timer);},[selectedChat,loadMessages]);
  useEffect(()=>{messagesEndRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});},[messages]);
  useEffect(()=>()=>{selectedId.current=null;},[]);
  const handleSend=async event=>{event.preventDefault();if(!messageText.trim()||!selectedChat||sendLock.current)return;const id=selectedChat.id;sendLock.current=true;setSending(true);setChatError('');try{await request('/messages',{method:'POST',body:JSON.stringify({conversation_id:id,sender:'admin',text:messageText.trim()})});if(selectedId.current===id){setMessageText('');await loadMessages(id);}loadConversations();}catch(err){if(selectedId.current===id)setChatError(err.message);}finally{sendLock.current=false;setSending(false);}};
  const filtered=conversations.filter(conv=>(conv.name||'').toLowerCase().includes(searchQuery.toLowerCase()));
  const getTime=time=>time?new Date(time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
  return <div className="page page-messaging"><PageHeader title="Messages" description="Stay in touch with your campus community." />
    <div className={`ui-panel chat-shell ${selectedChat?'chat-selected':''}`}>
      <section className="chat-list" aria-label="Conversations"><div className="chat-list-header"><h2>Inbox<span>{conversations.length}</span></h2><div className="search-field"><AppIcon name="search" /><input className="ui-input" aria-label="Search conversations" placeholder="Search conversations" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} /></div></div>
        <div className="chat-conversations">{loading?<LoadingState label="Loading inbox..." />:error?<ErrorState message={error} onRetry={loadConversations} />:!filtered.length?<EmptyState icon="messages" title={searchQuery?'No conversations found':'Your inbox is clear'} description={searchQuery?'Try another name.':'Messages from campus users will appear here.'} />:filtered.map(conv=><button type="button" className={`ui-button conversation ${selectedChat?.id===conv.id?'conversation-active':''}`} key={conv.id} onClick={()=>selectChat(conv)} aria-pressed={selectedChat?.id===conv.id}><span className="avatar">{conv.avatar||(conv.name||'?').charAt(0).toUpperCase()}</span><div><div className="conversation-title"><strong>{conv.name}</strong><time>{getTime(conv.last_message?.time)}</time></div><p>{conv.last_message?.text||'No messages yet'}</p></div>{conversationUnread(conv.id)>0&&<span className="nav-badge" aria-label={conversationUnread(conv.id)+' unread messages'}>{conversationUnread(conv.id)>99?'99+':conversationUnread(conv.id)}</span>}</button>)}</div>
      </section>
      <section className="chat-room" aria-label="Conversation">{selectedChat?<><header className="chat-room-header"><button className="icon-button chat-back" type="button" aria-label="Back to inbox" onClick={()=>{selectedId.current=null;setSelectedChat(null);}}><AppIcon name="back" /></button><span className="avatar">{selectedChat.avatar||selectedChat.name.charAt(0)}</span><div><strong>{selectedChat.name}</strong><p>Campus conversation</p></div></header>
        <div className="chat-messages" aria-live="polite">{chatLoading?<LoadingState label="Loading conversation..." />:messages.length?messages.map((msg,index)=><div className={`message-row ${msg.sender==='admin'?'message-outgoing':''}`} key={msg.id||index}><div className="message-bubble"><p>{msg.text}</p></div><time>{getTime(msg.time)}</time></div>):<EmptyState icon="messages" title="Start the conversation" description={`Send a message to ${selectedChat.name}.`} />}<div ref={messagesEndRef} /></div>
        {chatError&&<div className="chat-error"><ErrorState message={chatError} /></div>}
        <form className="chat-compose" onSubmit={handleSend}><input className="ui-input" aria-label="Message" placeholder="Write a message..." value={messageText} onChange={e=>setMessageText(e.target.value)} disabled={sending} /><button className="ui-button ui-button-primary" type="submit" disabled={sending||!messageText.trim()}><AppIcon name="send" />{sending?'Sending...':'Send'}</button></form>
      </>:<EmptyState icon="messages" title="Choose a conversation" description="Select someone from your inbox to view messages and reply." />}</section>
    </div>
  </div>;
}
