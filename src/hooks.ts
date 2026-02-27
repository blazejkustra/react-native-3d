import { useEffect, useState } from 'react';

/**
 * Demo hook that busy-waits on the JS thread to simulate heavy load.
 *
 * Returns a toggle function — when active, each animation frame blocks
 * the JS thread for 250 ms, demonstrating how worklet-based rendering
 * stays smooth even when the JS thread is saturated.
 */
export function useBusyJS() {
  const [working, setWorking] = useState(false);
  useEffect(() => {
    if (!working) {
      return;
    }
    let job = requestAnimationFrame(work);
    function work() {
      const sleepTime = 250;
      const now = performance.now();
      while (performance.now() - now < sleepTime) {
        // Busy-wait for a short time to simulate work
      }
      job = requestAnimationFrame(work);
    }
    return () => {
      cancelAnimationFrame(job);
    };
  }, [working]);

  return function toggleWorking() {
    setWorking((prev) => !prev);
  };
}
