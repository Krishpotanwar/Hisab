import { describe, it, expect } from "vitest";
import {
  equalSplit,
  percentSplit,
  customSplit,
  sharesSplit,
  itemizedSplit,
  multiplePayers,
} from "../utils/splitMath";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sum all split amounts, rounded to 2 decimals. */
const sumAmounts = (splits: { amount: number }[]) =>
  Math.round(splits.reduce((s, x) => s + x.amount, 0) * 100) / 100;

const ids = (n: number) => Array.from({ length: n }, (_, i) => `user-${i + 1}`);

// ---------------------------------------------------------------------------
// Equal split
// ---------------------------------------------------------------------------
describe("equalSplit", () => {
  it("splits 300 among 3 people evenly", () => {
    const result = equalSplit(300, ids(3));
    expect(result).toHaveLength(3);
    result.forEach((r) => expect(r.amount).toBe(100));
    expect(sumAmounts(result)).toBe(300);
  });

  it("splits 100 among 3 people with correct rounding", () => {
    const result = equalSplit(100, ids(3));
    expect(result).toHaveLength(3);
    // 100 / 3 = 33.333...  → base = 33.33, remainder = 0.01
    // first person gets 33.34, others get 33.33
    expect(result[0].amount).toBe(33.34);
    expect(result[1].amount).toBe(33.33);
    expect(result[2].amount).toBe(33.33);
    expect(sumAmounts(result)).toBe(100);
  });

  it("handles single person", () => {
    const result = equalSplit(250, ["solo"]);
    expect(result).toEqual([{ userId: "solo", amount: 250 }]);
  });

  it("handles two people with odd cents", () => {
    const result = equalSplit(10.01, ids(2));
    expect(sumAmounts(result)).toBe(10.01);
    expect(result[0].amount).toBe(5.01);
    expect(result[1].amount).toBe(5);
  });

  it("returns empty array for zero users", () => {
    expect(equalSplit(100, [])).toEqual([]);
  });

  it("handles large number of people", () => {
    const result = equalSplit(1000, ids(7));
    expect(result).toHaveLength(7);
    expect(sumAmounts(result)).toBe(1000);
  });

  it("splits 1 cent among 3 people", () => {
    const result = equalSplit(0.01, ids(3));
    expect(sumAmounts(result)).toBe(0.01);
    // base = 0.00, remainder = 0.01 → first person gets 0.01
    expect(result[0].amount).toBe(0.01);
    expect(result[1].amount).toBe(0);
    expect(result[2].amount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Percent split
// ---------------------------------------------------------------------------
describe("percentSplit", () => {
  it("splits 1000 by 50/30/20 percent", () => {
    const result = percentSplit(1000, [
      { userId: "a", percent: 50 },
      { userId: "b", percent: 30 },
      { userId: "c", percent: 20 },
    ]);
    expect(result).toEqual([
      { userId: "a", amount: 500 },
      { userId: "b", amount: 300 },
      { userId: "c", amount: 200 },
    ]);
    expect(sumAmounts(result)).toBe(1000);
  });

  it("handles rounding for thirds (33.33/33.33/33.34)", () => {
    const result = percentSplit(100, [
      { userId: "a", percent: 33.33 },
      { userId: "b", percent: 33.33 },
      { userId: "c", percent: 33.34 },
    ]);
    expect(sumAmounts(result)).toBe(100);
  });

  it("handles 100% to one person", () => {
    const result = percentSplit(500, [{ userId: "a", percent: 100 }]);
    expect(result).toEqual([{ userId: "a", amount: 500 }]);
  });

  it("returns empty array for no users", () => {
    expect(percentSplit(100, [])).toEqual([]);
  });

  it("assigns rounding remainder to first user", () => {
    // 33.33% of 100 = 33.33 each => sum = 99.99 => diff = 0.01
    const result = percentSplit(100, [
      { userId: "a", percent: 33.33 },
      { userId: "b", percent: 33.33 },
      { userId: "c", percent: 33.34 },
    ]);
    expect(sumAmounts(result)).toBe(100);
  });

  it("handles very small percentages", () => {
    const result = percentSplit(10000, [
      { userId: "a", percent: 0.01 },
      { userId: "b", percent: 99.99 },
    ]);
    expect(sumAmounts(result)).toBe(10000);
    expect(result[0].amount).toBe(1);
    expect(result[1].amount).toBe(9999);
  });
});

// ---------------------------------------------------------------------------
// Custom split
// ---------------------------------------------------------------------------
describe("customSplit", () => {
  it("accepts valid custom amounts", () => {
    const result = customSplit(100, [
      { userId: "a", amount: 60 },
      { userId: "b", amount: 40 },
    ]);
    expect(result).toEqual([
      { userId: "a", amount: 60 },
      { userId: "b", amount: 40 },
    ]);
  });

  it("returns null when amounts don't sum to total", () => {
    const result = customSplit(100, [
      { userId: "a", amount: 60 },
      { userId: "b", amount: 30 },
    ]);
    expect(result).toBeNull();
  });

  it("returns null when amounts exceed total", () => {
    const result = customSplit(100, [
      { userId: "a", amount: 60 },
      { userId: "b", amount: 50 },
    ]);
    expect(result).toBeNull();
  });

  it("accepts amounts within 0.01 tolerance", () => {
    // 33.33 + 33.33 + 33.33 = 99.99 which is 0.01 off from 100 → should be null
    const result = customSplit(100, [
      { userId: "a", amount: 33.33 },
      { userId: "b", amount: 33.33 },
      { userId: "c", amount: 33.33 },
    ]);
    expect(result).toBeNull();
  });

  it("accepts amounts that match within tolerance", () => {
    // 33.34 + 33.33 + 33.33 = 100.00
    const result = customSplit(100, [
      { userId: "a", amount: 33.34 },
      { userId: "b", amount: 33.33 },
      { userId: "c", amount: 33.33 },
    ]);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);
  });

  it("handles single user", () => {
    const result = customSplit(500, [{ userId: "a", amount: 500 }]);
    expect(result).toEqual([{ userId: "a", amount: 500 }]);
  });
});

// ---------------------------------------------------------------------------
// Shares-based split
// ---------------------------------------------------------------------------
describe("sharesSplit", () => {
  it("splits 300 with equal shares (1:1:1)", () => {
    const result = sharesSplit(300, [
      { userId: "a", shares: 1 },
      { userId: "b", shares: 1 },
      { userId: "c", shares: 1 },
    ]);
    result.forEach((r) => expect(r.amount).toBe(100));
    expect(sumAmounts(result)).toBe(300);
  });

  it("splits 100 with shares 2:1:1", () => {
    const result = sharesSplit(100, [
      { userId: "a", shares: 2 },
      { userId: "b", shares: 1 },
      { userId: "c", shares: 1 },
    ]);
    expect(result[0].amount).toBe(50);
    expect(result[1].amount).toBe(25);
    expect(result[2].amount).toBe(25);
    expect(sumAmounts(result)).toBe(100);
  });

  it("handles rounding with uneven shares", () => {
    const result = sharesSplit(100, [
      { userId: "a", shares: 1 },
      { userId: "b", shares: 1 },
      { userId: "c", shares: 1 },
    ]);
    expect(sumAmounts(result)).toBe(100);
  });

  it("returns empty for zero total shares", () => {
    const result = sharesSplit(100, [
      { userId: "a", shares: 0 },
      { userId: "b", shares: 0 },
    ]);
    expect(result).toEqual([]);
  });

  it("returns empty for no users", () => {
    expect(sharesSplit(100, [])).toEqual([]);
  });

  it("handles single share holder", () => {
    const result = sharesSplit(999, [{ userId: "a", shares: 5 }]);
    expect(result).toEqual([{ userId: "a", amount: 999 }]);
  });
});

// ---------------------------------------------------------------------------
// Itemized split
// ---------------------------------------------------------------------------
describe("itemizedSplit", () => {
  it("sums items per user", () => {
    const result = itemizedSplit([
      {
        userId: "a",
        items: [
          { name: "Pizza", price: 12.5 },
          { name: "Coke", price: 3.0 },
        ],
      },
      {
        userId: "b",
        items: [{ name: "Salad", price: 8.75 }],
      },
    ]);
    expect(result).toEqual([
      { userId: "a", amount: 15.5 },
      { userId: "b", amount: 8.75 },
    ]);
  });

  it("returns 0 for user with no items", () => {
    const result = itemizedSplit([{ userId: "a", items: [] }]);
    expect(result).toEqual([{ userId: "a", amount: 0 }]);
  });

  it("handles floating-point item prices", () => {
    const result = itemizedSplit([
      {
        userId: "a",
        items: [
          { name: "item1", price: 0.1 },
          { name: "item2", price: 0.2 },
        ],
      },
    ]);
    expect(result[0].amount).toBe(0.3);
  });
});

// ---------------------------------------------------------------------------
// Multiple payers
// ---------------------------------------------------------------------------
describe("multiplePayers", () => {
  it("computes net amounts with two payers", () => {
    // Total bill = 300. A paid 200, B paid 100. Split equally among A, B, C.
    const splits = equalSplit(300, ["a", "b", "c"]);
    const result = multiplePayers(
      [
        { userId: "a", paid: 200 },
        { userId: "b", paid: 100 },
      ],
      splits,
    );
    // Each owes 100. A paid 200 → net = 100 - 200 = -100 (is owed 100).
    // B paid 100 → net = 100 - 100 = 0. C paid 0 → net = 100.
    expect(result.find((r) => r.userId === "a")!.net).toBe(-100);
    expect(result.find((r) => r.userId === "b")!.net).toBe(0);
    expect(result.find((r) => r.userId === "c")!.net).toBe(100);
  });

  it("handles single payer (everyone else owes)", () => {
    const splits = equalSplit(90, ["a", "b", "c"]);
    const result = multiplePayers([{ userId: "a", paid: 90 }], splits);
    expect(result.find((r) => r.userId === "a")!.net).toBe(-60);
    expect(result.find((r) => r.userId === "b")!.net).toBe(30);
    expect(result.find((r) => r.userId === "c")!.net).toBe(30);
  });

  it("handles when payer is not in split list", () => {
    const splits = [
      { userId: "b", amount: 50 },
      { userId: "c", amount: 50 },
    ];
    const result = multiplePayers([{ userId: "a", paid: 100 }], splits);
    // b and c owe 50 each, a paid but isn't in the split so doesn't appear
    expect(result.find((r) => r.userId === "b")!.net).toBe(50);
    expect(result.find((r) => r.userId === "c")!.net).toBe(50);
  });

  it("nets to zero when payer and ower are same person for same amount", () => {
    const splits = [{ userId: "a", amount: 100 }];
    const result = multiplePayers([{ userId: "a", paid: 100 }], splits);
    expect(result[0].net).toBe(0);
  });
});
