/**
 * Secure random number generation using crypto.getRandomValues()
 * Use this for critical randomness needs like gacha picks
 */

/**
 * Generate a cryptographically secure random number between 0 (inclusive) and 1 (exclusive)
 * Similar to Math.random() but uses crypto.getRandomValues() for better randomness
 */
export function secureRandom(): number {
    // Use crypto.getRandomValues for cryptographically secure randomness
    const array = new Uint32Array(1);

    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(array);
    } else {
        // Fallback for environments without crypto (should not happen in modern browsers)
        console.warn('crypto.getRandomValues not available, falling back to Math.random()');
        return Math.random();
    }

    // Convert to a number between 0 and 1
    // Uint32Array max value is 2^32 - 1 = 4294967295
    return array[0] / 4294967296;
}

/**
 * Generate a cryptographically secure random integer between min (inclusive) and max (inclusive)
 */
export function secureRandomInt(min: number, max: number): number {
    const range = max - min + 1;
    return Math.floor(secureRandom() * range) + min;
}

/**
 * Select a random item from an array of items with weights
 * Uses cryptographically secure random for the selection
 *
 * @param items Array of items with their weights
 * @returns The selected item, or undefined if no items
 */
export function secureWeightedRandom<T>(
    items: Array<{ item: T; weight: number }>
): T | undefined {
    if (items.length === 0) return undefined;

    const totalWeight = items.reduce((sum, { weight }) => sum + weight, 0);
    if (totalWeight <= 0) return items[0]?.item;

    let random = secureRandom() * totalWeight;

    for (const { item, weight } of items) {
        random -= weight;
        if (random <= 0) return item;
    }

    // Fallback to first item (should not happen with proper weights)
    return items[0]?.item;
}

/**
 * Shuffle an array using cryptographically secure random (Fisher-Yates)
 * Returns a new array, does not modify the original
 */
export function secureShuffleArray<T>(array: T[]): T[] {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = secureRandomInt(0, i);
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}
