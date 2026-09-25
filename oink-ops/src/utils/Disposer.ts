/** Tracks GPU resources created by a theme/system so they can be released together. */
export class Disposer {
  private items: { dispose(): void }[] = [];
  track<T extends { dispose(): void }>(o: T): T {
    this.items.push(o);
    return o;
  }
  dispose() {
    for (const i of this.items) {
      try {
        i.dispose();
      } catch {
        /* ignore */
      }
    }
    this.items = [];
  }
}
