import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getJSON, setJSON } from '@/db/settings';
import { REMINDER_MESSAGES } from './wording';

/** Weekdays use expo-notifications numbering: 1 = Sunday ... 7 = Saturday. */
export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
  days: number[];
  messageIndex: number;
  notificationIds: string[];
}

export const DEFAULT_REMINDER: ReminderSettings = {
  enabled: false,
  hour: 7,
  minute: 0,
  days: [2, 3, 4, 5, 6],
  messageIndex: 0,
  notificationIds: [],
};

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CHANNEL = 'sunsafe';
const KEY = 'sunsafe_reminder';

export async function loadReminder(db: SQLiteDatabase): Promise<ReminderSettings> {
  return { ...DEFAULT_REMINDER, ...((await getJSON<ReminderSettings>(db, KEY)) ?? {}) };
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'SunSafe reminders',
      description: 'Sun protection reminders you set in LUMA',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export type PermissionResult = 'granted' | 'denied' | 'blocked';

export async function ensurePermission(): Promise<PermissionResult> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'blocked';
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted ? 'granted' : asked.canAskAgain ? 'denied' : 'blocked';
}

async function cancel(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

/**
 * Schedule (or clear) the repeating local reminder. Scheduled notifications
 * are kept by Android and fire without internet. Without the exact-alarm
 * permission they may arrive a few minutes late.
 */
export async function saveReminder(db: SQLiteDatabase, next: Omit<ReminderSettings, 'notificationIds'>, previous: ReminderSettings): Promise<ReminderSettings> {
  await cancel(previous.notificationIds);
  const ids: string[] = [];
  if (next.enabled && next.days.length > 0) {
    const content = { title: 'SunSafe', body: REMINDER_MESSAGES[next.messageIndex] ?? REMINDER_MESSAGES[0] };
    if (next.days.length === 7) {
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: next.hour, minute: next.minute, channelId: CHANNEL },
        }),
      );
    } else {
      for (const weekday of next.days) {
        ids.push(
          await Notifications.scheduleNotificationAsync({
            content,
            trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: next.hour, minute: next.minute, channelId: CHANNEL },
          }),
        );
      }
    }
  }
  const saved: ReminderSettings = { ...next, notificationIds: ids };
  await setJSON(db, KEY, saved);
  return saved;
}

/** Show a test reminder in a few seconds. */
export async function testReminder(messageIndex: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'SunSafe (test)', body: REMINDER_MESSAGES[messageIndex] ?? REMINDER_MESSAGES[0] },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
}

export function describeSchedule(r: Pick<ReminderSettings, 'hour' | 'minute' | 'days'>): string {
  const time = `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`;
  const sorted = [...r.days].sort();
  let days: string;
  if (sorted.length === 7) days = 'every day';
  else if (sorted.join() === '2,3,4,5,6') days = 'on school days (Monday to Friday)';
  else if (sorted.length === 0) days = 'on no days';
  else days = 'on ' + sorted.map((d) => DAY_NAMES[d - 1]).join(', ');
  return `${time} ${days}`;
}
