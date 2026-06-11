type Listener = (...args: any[]) => void;

const listeners = new Map<string, Set<Listener>>();

export const aiChatBus = {
  emit(event: string, ...args: any[]) {
    listeners.get(event)?.forEach((listener) => listener(...args));
  },

  off(event: string, listener?: Listener) {
    if (!listener) {
      listeners.delete(event);
      return;
    }

    const eventListeners = listeners.get(event);
    eventListeners?.delete(listener);
    if (eventListeners && eventListeners.size === 0) listeners.delete(event);
  },

  on(event: string, listener: Listener) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)?.add(listener);
  },
};
