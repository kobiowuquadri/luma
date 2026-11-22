package guard

import (
	"sync"
	"time"
)

// DeviceLimiter limits paid requests per device (or per IP when the app does
// not send an install ID) with a one-minute and a one-day window.
type DeviceLimiter struct {
	mu        sync.Mutex
	perMinute int
	perDay    int
	clients   map[string]*window
	now       func() time.Time
}

type window struct {
	minuteStart time.Time
	minuteCount int
	day         string
	dayCount    int
}

// NewDeviceLimiter creates a limiter.
func NewDeviceLimiter(perMinute, perDay int) *DeviceLimiter {
	return &DeviceLimiter{perMinute: perMinute, perDay: perDay, clients: map[string]*window{}, now: time.Now}
}

// Allow records one request for client. When it is refused, retryAfter says
// how long to wait and daily reports whether the daily allowance is used up.
func (l *DeviceLimiter) Allow(client string) (ok bool, retryAfter time.Duration, daily bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now().UTC()
	day := now.Format("2006-01-02")
	w, found := l.clients[client]
	if !found {
		if len(l.clients) > 50000 {
			l.pruneLocked(day)
		}
		w = &window{minuteStart: now, day: day}
		l.clients[client] = w
	}
	if w.day != day {
		w.day, w.dayCount = day, 0
	}
	if now.Sub(w.minuteStart) >= time.Minute {
		w.minuteStart, w.minuteCount = now, 0
	}
	if w.dayCount >= l.perDay {
		return false, untilUTCMidnight(now), true
	}
	if w.minuteCount >= l.perMinute {
		return false, time.Minute - now.Sub(w.minuteStart), false
	}
	w.minuteCount++
	w.dayCount++
	return true, 0, false
}

func (l *DeviceLimiter) pruneLocked(day string) {
	for k, w := range l.clients {
		if w.day != day {
			delete(l.clients, k)
		}
	}
}

// Budget caps the total number of paid provider calls per operation per UTC
// day across all devices. A limit of 0 disables the operation.
type Budget struct {
	mu     sync.Mutex
	limits map[string]int
	counts map[string]int
	day    string
	now    func() time.Time
}

// NewBudget creates a budget with per-operation daily limits.
func NewBudget(limits map[string]int) *Budget {
	return &Budget{limits: limits, counts: map[string]int{}, now: time.Now}
}

// Take reserves one call for op. It returns false when today's budget is used.
func (b *Budget) Take(op string) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	day := b.now().UTC().Format("2006-01-02")
	if day != b.day {
		b.day = day
		b.counts = map[string]int{}
	}
	limit, ok := b.limits[op]
	if !ok || b.counts[op] >= limit {
		return false
	}
	b.counts[op]++
	return true
}

// Refund returns a reserved call that did not reach the provider.
func (b *Budget) Refund(op string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.counts[op] > 0 {
		b.counts[op]--
	}
}

// Remaining reports how many calls are left today for op.
func (b *Budget) Remaining(op string) int {
	b.mu.Lock()
	defer b.mu.Unlock()
	day := b.now().UTC().Format("2006-01-02")
	if day != b.day {
		return b.limits[op]
	}
	return b.limits[op] - b.counts[op]
}

// UntilReset is the time until the daily budgets reset.
func (b *Budget) UntilReset() time.Duration { return untilUTCMidnight(b.now().UTC()) }

func untilUTCMidnight(now time.Time) time.Duration {
	next := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.UTC)
	return next.Sub(now)
}
