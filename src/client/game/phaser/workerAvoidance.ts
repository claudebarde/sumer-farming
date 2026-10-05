export type WorkerPoint = Readonly<{ x: number; y: number }>;
export type WorkerView = Readonly<{
  position: WorkerPoint;
  moving: boolean;
  yielding: boolean;
  visible: boolean;
}>;
export type YieldingWorker = {
  read: () => WorkerView;
  yieldTo: (point: WorkerPoint) => boolean;
};

const distance = (a: WorkerPoint, b: WorkerPoint) => Math.hypot(a.x - b.x, a.y - b.y);
/** Stay at the normal road height: no shoulder offsets or vertical steps over buildings. */
export const findYieldPosition = (idle: WorkerPoint, mover: WorkerView, roads: readonly WorkerPoint[], size: number): WorkerPoint | undefined =>
  roads.filter(p => Math.abs(p.y - idle.y) < 1 && distance(p, idle) > size * 0.4
    && distance(p, idle) <= size * 1.05 && distance(p, mover.position) >= size * 0.8)
    .sort((a, b) => distance(a, idle) - distance(b, idle))[0];

/** Only separate two stopped workers. Passing through a moving worker is allowed. */
export const updateWorkerAvoidance = (workers: readonly YieldingWorker[], roads: readonly WorkerPoint[], size: number, previouslyMoving: ReadonlySet<YieldingWorker> = new Set()): void => {
  for (let i = 0; i < workers.length; i++) {
    const a = workers[i]!; const av = a.read();
    if (!av.visible || av.moving || av.yielding) continue;
    for (let j = i + 1; j < workers.length; j++) {
      const b = workers[j]!; const bv = b.read();
      if (!bv.visible || bv.moving || bv.yielding || distance(av.position, bv.position) >= size * 0.6) continue;
      // Move the worker who was already standing there; otherwise prefer the porter.
      const order = previouslyMoving.has(b) && !previouslyMoving.has(a) ? [a, b] : [b, a];
      for (const worker of order) {
        const other = worker === a ? b : a;
        const target = findYieldPosition(worker.read().position, other.read(), roads, size);
        if (target && worker.yieldTo(target)) return;
      }
    }
  }
};

export const createWorkerAvoidance = () => {
  let previouslyMoving: ReadonlySet<YieldingWorker> = new Set();
  return (workers: readonly YieldingWorker[], roads: readonly WorkerPoint[], size: number) => {
    updateWorkerAvoidance(workers, roads, size, previouslyMoving);
    previouslyMoving = new Set(workers.filter(worker => worker.read().moving));
  };
};
