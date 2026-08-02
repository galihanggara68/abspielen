import { computeStats } from '../domain/stats.js';

export default function stats() {
  return {
    data: null,
    
    async init() {
      this.data = await computeStats();
    }
  };
}
