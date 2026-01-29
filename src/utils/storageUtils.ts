/**
 * Storage utility functions for formatting and status calculation
 */

// Storage limits by plan (in bytes)
export const STORAGE_LIMITS = {
    FREE: 15 * 1024 * 1024,      // 500 MB
    PREMIUM: 20 * 1024 * 1024 * 1024, // 20 GB
} as const;

export type StoragePlan = keyof typeof STORAGE_LIMITS;
export type StorageStatus = 'healthy' | 'warning' | 'critical';

/**
 * Get storage limit in bytes based on user plan
 */
export function getStorageLimitBytes(plan: StoragePlan = 'FREE'): number {
    return STORAGE_LIMITS[plan] || STORAGE_LIMITS.FREE;
}

/**
 * Format bytes to human-readable string (e.g., "1.5 GB", "256 MB")
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Calculate storage percentage used
 */
export function getStoragePercentage(used: number, limit: number): number {
    if (limit === 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
}

/**
 * Get storage status based on percentage:
 * - healthy: < 70%
 * - warning: 70-89%
 * - critical: >= 90%
 */
export function getStorageStatus(percentage: number): StorageStatus {
    if (percentage >= 90) return 'critical';
    if (percentage >= 70) return 'warning';
    return 'healthy';
}

/**
 * Check if there's enough storage for new files
 */
export function hasEnoughStorage(
    currentUsed: number,
    filesToUploadSize: number,
    limit: number
): boolean {
    return currentUsed + filesToUploadSize <= limit;
}

/**
 * Calculate remaining storage in bytes
 */
export function getRemainingStorage(used: number, limit: number): number {
    return Math.max(0, limit - used);
}
