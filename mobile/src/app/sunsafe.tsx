import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useOnline } from '@/ask/OnlineProvider';
import { getSetting, setSetting } from '@/db/settings';
import { announce } from '@/lib/a11y';
import { formatAge, formatWhen } from '@/lib/format';
import { CITIES, cityById } from '@/sunsafe/cities';
import { cacheForecast, cachedForecast, fetchForecast, isStale, type UvForecast } from '@/sunsafe/forecast';
import { DAY_NAMES, describeSchedule, ensurePermission, loadReminder, saveReminder, testReminder, type ReminderSettings } from '@/sunsafe/reminders';
import { REMINDER_MESSAGES, UV_ADVICE, UV_LABEL, uvLevel } from '@/sunsafe/wording';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Banner, Card, ChoiceGroup, SectionTitle, Stepper, ToggleRow } from '@/ui/parts';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';

function DayChip({ day, on, onPress }: { day: number; on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={DAY_NAMES[day - 1]}
      accessibilityState={{ checked: on }}
      style={{
        minWidth: 64,
        minHeight: 52,
        flexGrow: 1,
        borderRadius: t.radius,
        borderWidth: 2,
        borderColor: on ? t.palette.accent : t.palette.border,
        backgroundColor: on ? t.palette.accent : t.palette.surface,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: t.space(2),
      }}
    >
      <AppText weight="bold" tone={on ? 'onAccent' : 'text'}>
        {DAY_NAMES[day - 1].slice(0, 3)}
      </AppText>
    </Pressable>
  );
}

export default function SunSafeScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const online = useOnline();
  const [saved, setSaved] = useState<ReminderSettings | null>(null);
  const [edit, setEdit] = useState<ReminderSettings | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'blocked' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [cityId, setCityId] = useState<string | null>(null);
  const [forecast, setForecast] = useState<UvForecast | null>(null);
  const [forecastState, setForecastState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [pickCity, setPickCity] = useState(false);

  useEffect(() => {
    loadReminder(db).then((r) => {
      setSaved(r);
      setEdit(r);
    });
    getSetting(db, 'sunsafe_city').then((id) => setCityId(id));
  }, [db]);

  const refreshForecast = useCallback(
    async (id: string) => {
      const city = cityById(id);
      if (!city) return;
      setForecast(await cachedForecast(db, id));
      if (!online.connected) return;
      setForecastState('loading');
      try {
        const f = await fetchForecast(city);
        await cacheForecast(db, f);
        setForecast(f);
        setForecastState('idle');
        setForecastError(null);
      } catch (e) {
        setForecastState('error');
        setForecastError(e instanceof Error ? e.message : 'The forecast could not be loaded.');
      }
    },
    [db, online.connected],
  );

  useEffect(() => {
    if (cityId) refreshForecast(cityId);
  }, [cityId, refreshForecast]);

  if (!saved || !edit) return <Screen title="SunSafe">{null}</Screen>;

  const dirty = JSON.stringify({ ...edit, notificationIds: [] }) !== JSON.stringify({ ...saved, notificationIds: [] });

  const save = async (next: ReminderSettings) => {
    if (next.enabled) {
      const p = await ensurePermission();
      setPermission(p);
      if (p !== 'granted') {
        setStatus(null);
        return;
      }
    }
    const result = await saveReminder(db, next, saved);
    setSaved(result);
    setEdit(result);
    const msg = result.enabled ? `Reminder saved: ${describeSchedule(result)}.` : 'Reminder turned off.';
    setStatus(msg);
    announce(msg);
  };

  const city = cityById(cityId);
  const level = forecast ? uvLevel(forecast.maxUv) : null;
  const stale = forecast ? isStale(forecast) : false;

  return (
    <Screen title="SunSafe" kicker="Sun protection">
      <AppText>Set a reminder to protect your skin and eyes from the sun. Reminders work without internet.</AppText>

      <SectionTitle>Reminder</SectionTitle>
      <Card>
        <ToggleRow label="Daily sun reminder" value={edit.enabled} onChange={(enabled) => setEdit({ ...edit, enabled })} />
        {edit.enabled ? (
          <>
            <Stepper label="Hour" value={edit.hour} display={String(edit.hour).padStart(2, '0')} min={0} max={23} step={1} onChange={(hour) => setEdit({ ...edit, hour })} />
            <Stepper label="Minute" value={edit.minute} display={String(edit.minute).padStart(2, '0')} min={0} max={45} step={15} onChange={(minute) => setEdit({ ...edit, minute })} />
            <AppText weight="semibold">Days</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2) }}>
              {[2, 3, 4, 5, 6, 7, 1].map((d) => (
                <DayChip
                  key={d}
                  day={d}
                  on={edit.days.includes(d)}
                  onPress={() => setEdit({ ...edit, days: edit.days.includes(d) ? edit.days.filter((x) => x !== d) : [...edit.days, d] })}
                />
              ))}
            </View>
            <ChoiceGroup<number>
              label="Message"
              value={edit.messageIndex}
              onChange={(messageIndex) => setEdit({ ...edit, messageIndex })}
              options={REMINDER_MESSAGES.map((m, i) => ({ value: i, label: m }))}
            />
          </>
        ) : null}
        <AppText weight="semibold" accessibilityLiveRegion="polite">
          {saved.enabled ? `Saved: ${describeSchedule(saved)}.` : 'No reminder is set.'}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2) }}>
          <Button icon="check" label={edit.enabled ? 'Save reminder' : 'Save'} disabled={!dirty} onPress={() => save(edit)} style={{ flexGrow: 1 }} />
          <Button
            icon="bell"
            variant="secondary"
            label="Test reminder"
            hint="Shows a reminder in 5 seconds"
            onPress={async () => {
              const p = await ensurePermission();
              setPermission(p);
              if (p === 'granted') {
                await testReminder(edit.messageIndex);
                setStatus('A test reminder will appear in 5 seconds.');
                announce('A test reminder will appear in 5 seconds.');
              }
            }}
            style={{ flexGrow: 1 }}
          />
        </View>
        {status ? <Banner tone="success" title={status} /> : null}
        {permission === 'denied' || permission === 'blocked' ? (
          <Banner
            tone="warning"
            title="Notifications are off for LUMA"
            message="Reminders need permission to show notifications."
            action={permission === 'blocked' ? { label: 'Open phone settings', onPress: () => Linking.openSettings() } : { label: 'Ask again', onPress: () => save(edit) }}
          />
        ) : null}
      </Card>

      <SectionTitle>UV forecast</SectionTitle>
      <Card>
        <AppText>LUMA uses the city you choose. It does not use your location.</AppText>
        <Button icon="globe" variant="secondary" label={city ? `City: ${city.name}. Change` : 'Choose your city'} onPress={() => setPickCity(true)} />
        {city && forecast && level ? (
          <View accessible style={{ gap: t.space(2) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space(2) }}>
              <Icon name="sun" size={Math.round(t.size.display)} color={t.palette.accent} />
              <AppText variant="display">{forecast.maxUv}</AppText>
              <AppText variant="title">{UV_LABEL[level]}</AppText>
            </View>
            <AppText weight="semibold">Highest UV today in {city.name}</AppText>
            {forecast.highHours ? (
              <AppText>
                UV is high (6 or more) from {forecast.highHours[0]} to {forecast.highHours[1]}.
              </AppText>
            ) : null}
            <AppText>{UV_ADVICE[level]}</AppText>
            <AppText variant="small" tone="muted">
              Source: {forecast.source}. Updated {formatWhen(forecast.fetchedAt)}.
            </AppText>
          </View>
        ) : null}
        {city && forecast && stale ? (
          <Banner
            tone="warning"
            title="This forecast may be out of date"
            message={`It was updated ${formatAge(forecast.fetchedAt)}${forecast.date ? ` for ${forecast.date}` : ''}. ${online.connected ? 'Update it now.' : 'Connect to the internet to update it.'}`}
          />
        ) : null}
        {city && !forecast && !online.connected ? (
          <Banner tone="offline" title="Forecast not available offline" message="Connect to the internet to get today's UV forecast. Your reminders still work." />
        ) : null}
        {forecastState === 'error' ? (
          <Banner tone="warning" title="Forecast unavailable" message={`${forecastError ?? ''} Your reminders still work.`} />
        ) : null}
        {forecastState === 'loading' ? (
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: t.space(2), alignItems: 'center' }}>
            <ActivityIndicator color={t.palette.accent} />
            <AppText tone="muted">Updating the forecast…</AppText>
          </View>
        ) : null}
        {city && online.connected ? <Button icon="refresh" variant="quiet" label="Update forecast" onPress={() => refreshForecast(city.id)} /> : null}
      </Card>

      <Sheet visible={pickCity} title="Choose your city" onClose={() => setPickCity(false)}>
        <ChoiceGroup<string>
          label="City"
          value={cityId ?? ''}
          onChange={async (id) => {
            setCityId(id);
            await setSetting(db, 'sunsafe_city', id);
            setPickCity(false);
          }}
          options={CITIES.map((c) => ({ value: c.id, label: c.name, description: c.state }))}
        />
      </Sheet>
    </Screen>
  );
}
