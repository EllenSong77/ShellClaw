import { useEffect, useRef } from 'react';
import { useTaskStore } from '../stores/task';
import { api } from '../api/client';
import type { WSEvent } from '../types';

interface UseTaskPollingOptions {
  enabled?: boolean;
  interval?: number;
}

export function useTaskPolling({ enabled = true, interval = 2000 }: UseTaskPollingOptions = {}) {
  const currentTaskId = useTaskStore((state) => state.currentTaskId);
  const handleWSEvent = useTaskStore((state) => state.handleWSEvent);
  const intervalRef = useRef<number | undefined>(undefined);
  const lastTaskIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !currentTaskId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      return;
    }

    if (lastTaskIdRef.current !== currentTaskId) {
      lastTaskIdRef.current = currentTaskId;
      startedRef.current = false;
    }

    const pollTask = async () => {
      try {
        const task = await api.getTask(currentTaskId);

        if (task.status === 'running') {
          if (!startedRef.current) {
            startedRef.current = true;
            handleWSEvent({
              type: 'task_started',
              task_id: currentTaskId,
              status: 'running',
            });
          }
        } else if (task.status === 'completed') {
          const event: WSEvent = {
            type: 'task_completed',
            task_id: currentTaskId,
            status: 'completed',
            stdout_text: task.stdout_text || '',
            stderr_text: task.stderr_text || '',
            duration_sec: task.duration_sec || 0,
          };
          handleWSEvent(event);
        } else if (task.status === 'error') {
          const event: WSEvent = {
            type: 'task_error',
            task_id: currentTaskId,
            status: 'error',
            stdout_text: task.stdout_text || '',
            stderr_text: task.stderr_text || '',
            error_text: task.error_text || '任务失败',
            duration_sec: task.duration_sec || 0,
          };
          handleWSEvent(event);
        } else if (task.status === 'timeout') {
          const event: WSEvent = {
            type: 'task_error',
            task_id: currentTaskId,
            status: 'timeout',
            stdout_text: task.stdout_text || '',
            stderr_text: task.stderr_text || '',
            error_text: '任务超时',
            duration_sec: task.duration_sec || 0,
          };
          handleWSEvent(event);
        }
      } catch (err) {
        console.error('Failed to poll task:', err);
      }
    };

    // Poll immediately
    pollTask();

    // Then poll at interval
    intervalRef.current = window.setInterval(pollTask, interval);

    // Stop polling after 60s total duration if it doesn't stop naturally
    const timeoutId = window.setTimeout(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    }, 60000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      window.clearTimeout(timeoutId);
    };
  }, [enabled, currentTaskId, interval, handleWSEvent]);

  return {
    isPolling: Boolean(currentTaskId),
  };
}
