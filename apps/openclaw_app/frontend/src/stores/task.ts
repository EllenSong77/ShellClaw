import { create } from 'zustand';
import type { Task, TaskStatus, WSEvent, WSCreateTaskAction } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  taskId?: string;
  status?: TaskStatus | 'pending';
  isStreaming?: boolean;
}

interface TaskState {
  messages: Message[];
  currentTaskId: string | null;
  currentTask: Task | null;
  isStreaming: boolean;
  error: string | null;
  wsConnected: boolean;

  // Actions
  addUserMessage: (content: string) => void;
  enqueuePendingTask: (taskId: string) => void;
  handleWSEvent: (event: WSEvent) => void;
  setCurrentTask: (task: Task | null) => void;
  setWsConnected: (connected: boolean) => void;
  clearMessages: () => void;
  setError: (error: string | null) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  messages: [],
  currentTaskId: null,
  currentTask: null,
  isStreaming: false,
  error: null,
  wsConnected: false,

  addUserMessage: (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
    };
    set((state) => ({ messages: [...state.messages, message] }));
  },

  enqueuePendingTask: (taskId: string) => {
    set((state) => {
      if (state.messages.some((msg) => msg.taskId === taskId)) {
        return { currentTaskId: taskId, error: null };
      }

      const assistantMessage: Message = {
        id: taskId,
        role: 'assistant',
        content: 'Task queued...',
        taskId,
        status: 'pending',
        isStreaming: true,
      };

      return {
        currentTaskId: taskId,
        error: null,
        messages: [...state.messages, assistantMessage],
      };
    });
  },

  handleWSEvent: (event: WSEvent) => {
    switch (event.type) {
      case 'connected':
        set({ wsConnected: true });
        break;

      case 'pong':
        // Heartbeat response, no action needed
        break;

      case 'task_enqueued':
        // Task has been enqueued, waiting to start
        if (event.task_id) {
          get().enqueuePendingTask(event.task_id);
        }
        break;

      case 'task_started':
        // Task has started executing
        if (event.task_id) {
          set((state) => ({
            isStreaming: true,
            currentTaskId: event.task_id,
            messages: state.messages.map((msg) =>
              msg.taskId === event.task_id
                ? {
                    ...msg,
                    status: 'running',
                    isStreaming: true,
                    content: 'Running...',
                  }
                : msg
            ),
          }));
        }
        break;

      case 'task_delta':
        // Streaming text is intentionally disabled in the UI.
        break;

      case 'task_completed':
        // Task finished successfully
        if (event.task_id) {
          set((state) => ({
            isStreaming: false,
            currentTaskId: null,
            messages: state.messages.map((msg) =>
              msg.taskId === event.task_id
                ? {
                    ...msg,
                    status: 'completed',
                    isStreaming: false,
                    content: event.stdout_text || msg.content || 'Task completed',
                  }
                : msg
            ),
          }));
        }
        break;

      case 'task_error':
        // Task failed with error
        if (event.task_id) {
          const errorContent = event.error_text || event.stderr_text || event.stdout_text || 'Task failed';
          const errorStatus = event.status === 'timeout' ? 'timeout' : 'error';
          set((state) => ({
            isStreaming: false,
            currentTaskId: null,
            error: errorContent,
            messages: state.messages.map((msg) =>
              msg.taskId === event.task_id
                ? {
                    ...msg,
                    status: errorStatus,
                    isStreaming: false,
                    content: errorContent,
                  }
                : msg
            ),
          }));
        }
        break;
    }
  },

  setCurrentTask: (task: Task | null) => {
    set({ currentTask: task });
  },

  setWsConnected: (connected: boolean) => {
    set({ wsConnected: connected });
  },

  clearMessages: () => {
    set({ messages: [], currentTaskId: null, currentTask: null, error: null });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));

// Helper to create WebSocket task action
export function createWSTaskAction(message: string, timeoutSec = 120): string {
  const action: WSCreateTaskAction = {
    action: 'create_task',
    message,
    timeout_sec: timeoutSec,
  };
  return JSON.stringify(action);
}
