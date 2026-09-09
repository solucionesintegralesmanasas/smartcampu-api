const { createTokenBucket } = require('@uajs/shared-utils');

describe('Token Bucket Unit', () => {
  let bucket;

  beforeEach(() => {
    bucket = createTokenBucket({ capacity: 5, refillPerSecond: 2, sweepIntervalMs: 10000 });
  });

  afterEach(() => {
    bucket.stop();
  });

  it('debe permitir consumes hasta alcanzar la capacidad', () => {
    for (let i = 1; i <= 5; i += 1) {
      const res = bucket.consume('test-key');
      expect(res.allowed).toBe(true);
      // Con refillPerSecond=2, el refill perezoso añade fracciones de token entre
      // consumes, por lo que remaining es 5-i más una fracción despreciable.
      expect(res.remaining).toBeCloseTo(5 - i, 1);
    }
  });

  it('debe denegar el consume 6 y devolver retryAfterSeconds', () => {
    for (let i = 1; i <= 5; i += 1) bucket.consume('test-key');

    const res = bucket.consume('test-key');
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBeLessThan(1);
    expect(res.retryAfterSeconds).toBeGreaterThan(0); // 1 / 2 = 0.5 -> ceil = 1
  });
});
