package guard

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestIdempotencyReplaysCompletedResponse(t *testing.T) {
	s := NewIdempotency(time.Minute, 1<<20)
	ctx := context.Background()
	prev, ticket, err := s.Begin(ctx, "k1", "fp")
	if err != nil || prev != nil || ticket == nil {
		t.Fatalf("first Begin = %v %v %v", prev, ticket, err)
	}
	ticket.Complete(&Response{Status: 200, ContentType: "application/json", Body: []byte(`{"ok":true}`)})

	prev, ticket, err = s.Begin(ctx, "k1", "fp")
	if err != nil || ticket != nil || prev == nil || string(prev.Body) != `{"ok":true}` {
		t.Fatalf("replay Begin = %v %v %v", prev, ticket, err)
	}
}

func TestIdempotencyRejectsDifferentRequestWithSameKey(t *testing.T) {
	s := NewIdempotency(time.Minute, 1<<20)
	_, ticket, _ := s.Begin(context.Background(), "k1", "fp-a")
	ticket.Complete(&Response{Status: 200, Body: []byte("a")})
	if _, _, err := s.Begin(context.Background(), "k1", "fp-b"); !errors.Is(err, ErrConflict) {
		t.Fatalf("err = %v, want ErrConflict", err)
	}
}

func TestIdempotencyAbortAllowsRetry(t *testing.T) {
	s := NewIdempotency(time.Minute, 1<<20)
	_, ticket, _ := s.Begin(context.Background(), "k1", "fp")
	ticket.Abort()
	prev, ticket, err := s.Begin(context.Background(), "k1", "fp")
	if err != nil || prev != nil || ticket == nil {
		t.Fatal("retry after abort should get a new ticket")
	}
}

func TestIdempotencyConcurrentDuplicatesDoWorkOnce(t *testing.T) {
	s := NewIdempotency(time.Minute, 1<<20)
	var work int32
	var wg sync.WaitGroup
	results := make([]string, 8)
	for i := range results {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			prev, ticket, err := s.Begin(context.Background(), "same", "fp")
			if err != nil {
				t.Error(err)
				return
			}
			if ticket != nil {
				atomic.AddInt32(&work, 1)
				time.Sleep(20 * time.Millisecond)
				ticket.Complete(&Response{Status: 200, Body: []byte("answer")})
				results[i] = "answer"
				return
			}
			results[i] = string(prev.Body)
		}(i)
	}
	wg.Wait()
	if work != 1 {
		t.Fatalf("work done %d times, want 1", work)
	}
	for _, r := range results {
		if r != "answer" {
			t.Fatalf("results = %v", results)
		}
	}
}

func TestIdempotencyExpires(t *testing.T) {
	s := NewIdempotency(time.Minute, 1<<20)
	now := time.Date(2026, 11, 20, 10, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return now }
	_, ticket, _ := s.Begin(context.Background(), "k", "fp")
	ticket.Complete(&Response{Status: 200, Body: []byte("x")})
	now = now.Add(2 * time.Minute)
	if prev, ticket, _ := s.Begin(context.Background(), "k", "fp"); prev != nil || ticket == nil {
		t.Fatal("expired entry was replayed")
	}
}

func TestIdempotencyEvictsOverByteCap(t *testing.T) {
	s := NewIdempotency(time.Minute, 10)
	for _, k := range []string{"a", "b", "c"} {
		_, ticket, _ := s.Begin(context.Background(), k, "fp")
		ticket.Complete(&Response{Status: 200, Body: []byte("12345")})
	}
	if s.bytes > 10 {
		t.Fatalf("bytes = %d, over cap", s.bytes)
	}
}

func TestDeviceLimiterMinuteAndDay(t *testing.T) {
	l := NewDeviceLimiter(2, 3)
	now := time.Date(2026, 11, 20, 10, 0, 0, 0, time.UTC)
	l.now = func() time.Time { return now }
	for i := 0; i < 2; i++ {
		if ok, _, _ := l.Allow("d1"); !ok {
			t.Fatalf("request %d refused", i)
		}
	}
	if ok, wait, daily := l.Allow("d1"); ok || daily || wait <= 0 {
		t.Fatalf("third request in a minute: ok=%v wait=%v daily=%v", ok, wait, daily)
	}
	if ok, _, _ := l.Allow("d2"); !ok {
		t.Fatal("another device was limited")
	}
	now = now.Add(61 * time.Second)
	if ok, _, _ := l.Allow("d1"); !ok {
		t.Fatal("new minute should allow")
	}
	if ok, _, daily := l.Allow("d1"); ok || !daily {
		t.Fatalf("daily cap not applied: ok=%v daily=%v", ok, daily)
	}
	now = now.Add(24 * time.Hour)
	if ok, _, _ := l.Allow("d1"); !ok {
		t.Fatal("new day should allow")
	}
}

func TestBudgetResetsDaily(t *testing.T) {
	b := NewBudget(map[string]int{"ask": 2, "speech": 0})
	now := time.Date(2026, 11, 20, 23, 59, 0, 0, time.UTC)
	b.now = func() time.Time { return now }
	if !b.Take("ask") || !b.Take("ask") || b.Take("ask") {
		t.Fatal("ask budget not enforced")
	}
	if b.Take("speech") {
		t.Fatal("limit 0 should disable the operation")
	}
	b.Refund("ask")
	if b.Remaining("ask") != 1 {
		t.Fatalf("remaining = %d", b.Remaining("ask"))
	}
	now = now.Add(2 * time.Minute)
	if !b.Take("ask") || b.Remaining("ask") != 1 {
		t.Fatal("budget should reset at UTC midnight")
	}
}
