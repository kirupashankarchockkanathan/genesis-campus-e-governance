import { EventEmitter } from 'node:events';

// In-process fan-out to open Server-Sent-Event streams (spec 7.1). Notifications are saved in the
// database first, then pushed here. A single API instance is assumed (see DECISIONS D31).
export const hub = new EventEmitter();
hub.setMaxListeners(0);

export const publish = (userId, notification) => hub.emit(`user:${userId}`, notification);
export const subscribe = (userId, listener) => {
  hub.on(`user:${userId}`, listener);
  return () => hub.off(`user:${userId}`, listener);
};
