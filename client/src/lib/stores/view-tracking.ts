import { get, set, del } from 'idb-keyval';
import { writable } from 'svelte/store';

export interface ProfileView {
  profileId: string;
  timestamp: number;
  username: string;
}

interface ViewTrackingData {
  views: ProfileView[];
  lastCleanup: number;
}

const VIEW_STORAGE_KEY = 'forkflirt_profile_views_v1';
const MAX_VIEWS_PER_HOUR = 50;
const VIEW_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_STORED_VIEWS = 500;

// Svelte store for reactive UI updates
export const viewTrackingStore = writable<ViewTrackingData>({
  views: [],
  lastCleanup: Date.now()
});

/**
 * Checks if a user can view a profile based on rate limiting
 */
export async function canViewProfile(_profileId: string, _username: string): Promise<boolean> {
  const data = await getViewTrackingData();
  const now = Date.now();

  // Clean old views
  await cleanOldViews(data, now);

  // Count views in the last hour
  const recentViews = data.views.filter(view =>
    now - view.timestamp < VIEW_WINDOW_MS
  );

  if (recentViews.length >= MAX_VIEWS_PER_HOUR) {
    console.warn(`Profile view rate limit reached (${recentViews.length}/${MAX_VIEWS_PER_HOUR} per hour)`);
    return false;
  }

  return true;
}

/**
 * Records a profile view for rate limiting purposes
 */
export async function recordProfileView(profileId: string, username: string): Promise<void> {
  const data = await getViewTrackingData();
  const now = Date.now();

  // Clean old views
  await cleanOldViews(data, now);

  // Add new view
  data.views.push({
    profileId,
    username,
    timestamp: now
  });

  // Enforce maximum storage
  if (data.views.length > MAX_STORED_VIEWS) {
    // Keep only recent views
    data.views.sort((a, b) => b.timestamp - a.timestamp);
    data.views = data.views.slice(0, MAX_STORED_VIEWS);
  }

  data.lastCleanup = now;

  await set(VIEW_STORAGE_KEY, data);
  viewTrackingStore.set(data);
}

/**
 * Gets current view tracking data
 */
export async function getViewTrackingData(): Promise<ViewTrackingData> {
  const stored = await get<ViewTrackingData>(VIEW_STORAGE_KEY);
  return stored || {
    views: [],
    lastCleanup: Date.now()
  };
}

/**
 * Gets view statistics for the last hour
 */
export async function getViewStats(): Promise<{
  totalViews: number;
  uniqueProfiles: number;
  viewsThisHour: number;
  timeUntilReset: number;
}> {
  const data = await getViewTrackingData();
  const now = Date.now();
  const hourAgo = now - VIEW_WINDOW_MS;

  const viewsThisHour = data.views.filter(v => v.timestamp > hourAgo);
  const uniqueProfiles = new Set(viewsThisHour.map(v => v.profileId)).size;

  // Find oldest view in current window to calculate reset time
  const oldestView = viewsThisHour.length > 0 ? Math.min(...viewsThisHour.map(v => v.timestamp)) : now;
  const timeUntilReset = Math.max(0, VIEW_WINDOW_MS - (now - oldestView));

  return {
    totalViews: data.views.length,
    uniqueProfiles,
    viewsThisHour: viewsThisHour.length,
    timeUntilReset
  };
}

/**
 * Clears all view tracking data
 */
export async function clearViewTracking(): Promise<void> {
  await del(VIEW_STORAGE_KEY);
  viewTrackingStore.set({
    views: [],
    lastCleanup: Date.now()
  });
}

/**
 * Removes views older than the tracking window
 */
async function cleanOldViews(data: ViewTrackingData, now: number): Promise<void> {
  const cutoff = now - VIEW_WINDOW_MS;
  const originalLength = data.views.length;

  data.views = data.views.filter(view => view.timestamp > cutoff);

  if (data.views.length !== originalLength) {
    data.lastCleanup = now;
    await set(VIEW_STORAGE_KEY, data);
    viewTrackingStore.set(data);
  }
}

/**
 * Blocks a user from viewing profiles for a specified duration
 */
export async function blockProfileViewing(durationMs: number = 30 * 60 * 1000): Promise<void> {
  const data = await getViewTrackingData();
  const now = Date.now();

  // Fill up the view limit to block further views
  const blockDuration = Math.min(durationMs, VIEW_WINDOW_MS);
  const viewsToAdd = MAX_VIEWS_PER_HOUR - data.views.filter(v => now - v.timestamp < VIEW_WINDOW_MS).length;

  for (let i = 0; i < viewsToAdd + 1; i++) {
    data.views.push({
      profileId: 'blocked',
      username: 'blocked',
      timestamp: now - (VIEW_WINDOW_MS - blockDuration) + (i * 1000)
    });
  }

  await set(VIEW_STORAGE_KEY, data);
  viewTrackingStore.set(data);
}

// Initialize store from storage
async function initializeStore() {
  const data = await getViewTrackingData();
  viewTrackingStore.set(data);
}

// Auto-cleanup old views periodically
setInterval(async () => {
  const data = await getViewTrackingData();
  await cleanOldViews(data, Date.now());
}, 5 * 60 * 1000); // Every 5 minutes

// Initialize on import
initializeStore();