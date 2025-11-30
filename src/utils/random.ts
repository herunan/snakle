export class SeededRNG {
    private seed: number;

    constructor(seed: string) {
        // Simple hash of the string to get a number
        let h = 0xdeadbeef;
        for (let i = 0; i < seed.length; i++) {
            h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
        }
        this.seed = (h ^ h >>> 16) >>> 0;
    }

    // Returns a float between 0 and 1
    next(): number {
        this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
        return this.seed / 4294967296;
    }

    // Returns an integer between min and max (inclusive)
    nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
}

export const getDailySeed = (): string => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
};

export const getDailyNumber = (): number => {
    const epochStart = new Date('2024-01-01T00:00:00Z');
    const now = new Date();
    const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const diffTime = utcNow.getTime() - epochStart.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
};
