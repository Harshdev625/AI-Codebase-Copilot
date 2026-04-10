import * as React from 'react';
import { chatService } from '../services/chat-service';
import { ChatMessage } from '../types/chat-types';
import { useToast } from '@/components/shared/toast-provider';

export function useChat(repositoryId: string, initialSessionId?: string) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = React.useState(false);
  const [currentSessionId, setCurrentSessionId] = React.useState<string | undefined>(initialSessionId);
  const { warning, error, success } = useToast();

  // Load history if session_id is provided or changes
  React.useEffect(() => {
    if (currentSessionId) {
      loadHistory(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  const loadHistory = async (sid: string) => {
    try {
      const response = await chatService.getSessionMessages(sid);
      if (response.success && response.data) {
        setMessages(response.data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          metadata: m.metadata
        })));
      }
    } catch (err) {
      console.error('Failed to load history', err);
    }
  };

  const sendMessage = async (query: string) => {
    if (!repositoryId) {
      warning('Selection Required', 'Choose a repository to start analyzing.');
      return;
    }

    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);

    try {
      // Create a placeholder for assistant message
      const assistantId = Math.random().toString(36).substring(7);
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', metadata: { intent: 'thinking...' } },
      ]);

      let fullContent = '';
      await chatService.streamChat(
        { query, repository_id: repositoryId, session_id: currentSessionId },
        (event) => {
          if (event.type === 'start' && event.session_id) {
            setCurrentSessionId(event.session_id);
          }
          if (event.type === 'chunk' && event.delta) {
            fullContent += event.delta;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: fullContent } : msg
              )
            );
          }
          if (event.type === 'done') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: fullContent, metadata: { intent: event.intent, sources: event.sources } }
                  : msg
              )
            );
          }
        }
      );
    } catch (err: any) {
      error('Message Failed', err.message || 'The AI service encountered an error.');
      setMessages((prev) => prev.slice(0, -1)); // Remove the assistant placeholder
    } finally {
      setIsSending(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
    setCurrentSessionId(undefined);
  };

  return {
    messages,
    sendMessage,
    isSending,
    clearMessages,
    currentSessionId,
    setCurrentSessionId,
  };
}
