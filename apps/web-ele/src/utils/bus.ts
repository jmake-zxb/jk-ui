// 简单的事件总线实现，不依赖外部库
type EventHandler = (...args: any[]) => void;

class EventBus {
  private events: Map<string | symbol, EventHandler[]> = new Map();

  emit(type: string | symbol, ...args: any[]) {
    const handlers = this.events.get(type);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
  }

  off(type: string | symbol, handler?: EventHandler) {
    if (!handler) {
      this.events.delete(type);
      return;
    }
    const handlers = this.events.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  on(type: string | symbol, handler: EventHandler) {
    const handlers = this.events.get(type) || [];
    handlers.push(handler);
    this.events.set(type, handlers);
  }
}

const bus = new EventBus();

export default bus;
