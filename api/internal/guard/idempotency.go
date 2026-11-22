// Package guard protects paid provider calls: idempotent retries, a per-device
// rate limit and global daily budgets.
package guard

import (
	"context"
	"errors"
	"sync"
	"time"
)

// ErrConflict means an idempotency key was reused for a different request.
var ErrConflict = errors.New("idempotency key reused with a different request")

// Response is a completed response kept for replay.
type Response struct {
	Status      int
	ContentType string
	Headers     map[string]string
	Body        []byte
}

type entry struct {
	fingerprint string
	done        chan struct{}
	resp        *Response
	expires     time.Time
}

// Idempotency stores recent successful responses by client-supplied key so a
// retry after a dropped connection does not pay for the same work twice.
// Concurrent duplicates wait for the first request instead of calling the
// provider again. Failed attempts are forgotten so they can be retried.
type Idempotency struct {
	mu       sync.Mutex
	entries  map[string]*entry
	ttl      time.Duration
	maxBytes int
	bytes    int
	now      func() time.Time
}

// NewIdempotency creates a store that keeps responses for ttl and at most
// maxBytes of response bodies.
func NewIdempotency(ttl time.Duration, maxBytes int) *Idempotency {
	return &Idempotency{entries: map[string]*entry{}, ttl: ttl, maxBytes: maxBytes, now: time.Now}
}

// Ticket is held by the request that does the work.
type Ticket struct {
	store *Idempotency
	key   string
	e     *entry
}

// Begin claims key. Exactly one of the results is meaningful:
//   - replay != nil: a stored response for the same request; send it.
//   - ticket != nil: this request must do the work, then Complete or Abort.
//   - err: ErrConflict, or the context ended while waiting for a duplicate.
func (s *Idempotency) Begin(ctx context.Context, key, fingerprint string) (replay *Response, ticket *Ticket, err error) {
	for {
		s.mu.Lock()
		s.sweepLocked()
		e, ok := s.entries[key]
		if !ok {
			e = &entry{fingerprint: fingerprint, done: make(chan struct{})}
			s.entries[key] = e
			s.mu.Unlock()
			return nil, &Ticket{store: s, key: key, e: e}, nil
		}
		if e.fingerprint != fingerprint {
			s.mu.Unlock()
			return nil, nil, ErrConflict
		}
		if e.resp != nil {
			r := e.resp
			s.mu.Unlock()
			return r, nil, nil
		}
		done := e.done
		s.mu.Unlock()
		select {
		case <-done:
			// Loop: either a response is stored now, or the attempt was
			// aborted and this request may claim the key.
		case <-ctx.Done():
			return nil, nil, ctx.Err()
		}
	}
}

// Complete stores a successful response for replay and wakes waiters.
func (t *Ticket) Complete(r *Response) {
	s := t.store
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(r.Body) <= s.maxBytes {
		t.e.resp = r
		t.e.expires = s.now().Add(s.ttl)
		s.bytes += len(r.Body)
		s.evictLocked()
	} else {
		delete(s.entries, t.key)
	}
	close(t.e.done)
}

// Abort forgets a failed attempt so a retry can try again.
func (t *Ticket) Abort() {
	s := t.store
	s.mu.Lock()
	defer s.mu.Unlock()
	if cur, ok := s.entries[t.key]; ok && cur == t.e {
		delete(s.entries, t.key)
	}
	close(t.e.done)
}

func (s *Idempotency) sweepLocked() {
	now := s.now()
	for k, e := range s.entries {
		if e.resp != nil && now.After(e.expires) {
			s.bytes -= len(e.resp.Body)
			delete(s.entries, k)
		}
	}
}

// evictLocked drops the oldest completed responses while over the byte cap.
func (s *Idempotency) evictLocked() {
	for s.bytes > s.maxBytes {
		var oldestKey string
		var oldest time.Time
		for k, e := range s.entries {
			if e.resp == nil {
				continue
			}
			if oldestKey == "" || e.expires.Before(oldest) {
				oldestKey, oldest = k, e.expires
			}
		}
		if oldestKey == "" {
			return
		}
		s.bytes -= len(s.entries[oldestKey].resp.Body)
		delete(s.entries, oldestKey)
	}
}
