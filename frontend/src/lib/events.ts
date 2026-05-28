export type EventCallback = (data?: any) => void;

class EventBus {
  private events: Record<string, EventCallback[]> = {};

  on(event: string, callback: EventCallback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.events[event] = this.events[event].filter((cb) => cb !== callback);
    };
  }

  emit(event: string, data?: any) {
    if (this.events[event]) {
      this.events[event].forEach((cb) => {
        try {
          cb(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}

export const globalEvents = new EventBus();

// Strongly typed events
export const EVENTS = {
  UNAUTHORIZED: 'auth:unauthorized',
} as const;
