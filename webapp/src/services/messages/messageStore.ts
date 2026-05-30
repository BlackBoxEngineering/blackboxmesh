import type { NormalizedMessage } from './types';

const MAX_MESSAGES = 400;

class MessageStore {
  private messages: NormalizedMessage[] = [];
  private cbs: Array<(messages: NormalizedMessage[]) => void> = [];

  getAll(): NormalizedMessage[] {
    return this.messages;
  }

  add(message: NormalizedMessage): void {
    this.messages = [...this.messages.slice(-(MAX_MESSAGES - 1)), message];
    this.emit();
  }

  addMany(messages: NormalizedMessage[]): void {
    if (messages.length === 0) return;
    this.messages = [...this.messages, ...messages].slice(-MAX_MESSAGES);
    this.emit();
  }

  onMessages(cb: (messages: NormalizedMessage[]) => void): () => void {
    this.cbs.push(cb);
    cb(this.messages);
    return () => {
      this.cbs = this.cbs.filter((x) => x !== cb);
    };
  }

  private emit(): void {
    for (const cb of this.cbs) cb(this.messages);
  }
}

export const messageStore = new MessageStore();

