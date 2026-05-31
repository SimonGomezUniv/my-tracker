import ChallengeModel from '../models/challenge.js';
import TrackingEntryModel from '../models/tracking-entry.js';
import { computeChallengeStats } from './challenge-stats.service.js';
import { showToast } from '../utils.js';

const STORAGE_KEY = 'my-tracker-challenge-rewards-v1';

const REWARD_DEFINITIONS = [
  { id: 'first-check', icon: '🌱', label: 'First check', test: stats => stats.totalValue > 0 },
  { id: 'volume-10', icon: '📈', label: 'Volume 10+', test: stats => stats.totalValue >= 10 },
  { id: 'volume-50', icon: '📊', label: 'Volume 50+', test: stats => stats.totalValue >= 50 },
  { id: 'volume-100', icon: '💎', label: 'Volume 100+', test: stats => stats.totalValue >= 100 },
  { id: 'streak-3', icon: '🔥', label: '3-day streak', test: stats => stats.bestStreak >= 3 },
  { id: 'streak-7', icon: '⚡', label: '7-day streak', test: stats => stats.bestStreak >= 7 },
  { id: 'streak-14', icon: '🏅', label: '14-day streak', test: stats => stats.bestStreak >= 14 },
  { id: 'goal-complete', icon: '🏆', label: 'Goal completed', test: stats => stats.progress >= 100 },
];

function getStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStorage(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function getRewardKey(challengeId, itemId, rewardId) {
  return `${challengeId}:${itemId}:${rewardId}`;
}

export function computeItemRewards(challenge, item, itemStats) {
  if (!item?.rewardsEnabled) return [];
  return REWARD_DEFINITIONS
    .filter(reward => reward.test(itemStats))
    .map(reward => ({
      ...reward,
      challengeId: challenge.id,
      challengeName: challenge.name,
      itemId: item.id,
      itemName: item.name,
      unlocked: true,
    }));
}

export async function notifyNewChallengeRewards() {
  const [challenges, entries] = await Promise.all([
    ChallengeModel.getAll(),
    TrackingEntryModel.getAll(),
  ]);

  const storage = getStorage();
  const newlyUnlocked = [];

  challenges.forEach(challenge => {
    const stats = computeChallengeStats(challenge, entries);
    stats.itemStats.forEach(({ item, stats: itemStats }) => {
      computeItemRewards(challenge, item, itemStats).forEach(reward => {
        const key = getRewardKey(challenge.id, item.id, reward.id);
        if (storage[key]) return;
        storage[key] = new Date().toISOString();
        newlyUnlocked.push(reward);
      });
    });
  });

  if (newlyUnlocked.length > 0) {
    saveStorage(storage);
    newlyUnlocked.slice(0, 3).forEach(reward => {
      showToast(`${reward.icon} ${reward.itemName}: ${reward.label}`, 'success', 2600);
    });
  }

  return newlyUnlocked;
}

export function getUnlockedRewardMap() {
  return getStorage();
}

export function exportChallengeRewardsState() {
  return getStorage();
}

export function importChallengeRewardsState(value) {
  if (!value || typeof value !== 'object') {
    saveStorage({});
    return;
  }
  const normalized = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => typeof key === 'string' && key.includes(':'))
      .map(([key, unlockedAt]) => [key, String(unlockedAt || new Date().toISOString())]),
  );
  saveStorage(normalized);
}
