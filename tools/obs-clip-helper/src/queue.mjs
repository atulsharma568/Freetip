// One clip at a time, in the order the moments were saved. Cutting video is heavy, so a
// burst of moments waits in line. The same moment is never done twice (a poll that
// repeats itself), and a very long line drops the newest rather than growing forever.

export function createQueue(worker, { max = 20, onDrop = () => {}, onError = () => {} } = {}) {
  const seen = new Set();
  const line = [];
  let running = null;

  async function drain() {
    while (line.length) {
      const item = line.shift();
      try {
        await worker(item);
      } catch (err) {
        // One bad clip must not stop the ones behind it.
        onError(item, err);
      }
    }
    running = null;
  }

  return {
    push(item) {
      if (seen.has(item.id)) return "duplicate";
      seen.add(item.id);
      if (line.length >= max) {
        onDrop(item);
        return "full";
      }
      line.push(item);
      if (!running) running = drain();
      return "queued";
    },
    get waiting() {
      return line.length;
    },
    // Resolves when the line is empty and nothing is running.
    async idle() {
      while (running) await running;
    },
  };
}
