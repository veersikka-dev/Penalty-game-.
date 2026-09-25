/** Generic free-list pool. Avoids per-frame allocation of meshes and other heavy objects. */
export class ObjectPool<T> {
  private free: T[] = [];
  constructor(private create: () => T, private reset?: (o: T) => void, prefill = 0) {
    for (let i = 0; i < prefill; i++) this.free.push(create());
  }
  acquire(): T {
    return this.free.pop() ?? this.create();
  }
  release(o: T) {
    this.reset?.(o);
    this.free.push(o);
  }
  get available() {
    return this.free.length;
  }
}
