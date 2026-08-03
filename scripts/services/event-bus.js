function createEventBus() {
  const listeners = new Map();
  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => listeners.get(event)?.delete(handler);
    },
    emit(event, payload) {
      listeners.get(event)?.forEach((handler) => {
        try { handler(payload); } catch (err) { console.error(`Event handler for "${event}" threw:`, err); }
      });
    },
  };
}
export const bus = createEventBus();
