package realtime

import (
	"sync"
	"time"
)

const TypingTTL = 5 * time.Second

type typingEntry struct {
	timer      *time.Timer
	lastNotify time.Time
}

type TypingTracker struct {
	mu      sync.Mutex
	entries map[string]map[string]*typingEntry // conversationID -> userID
	byUser  map[string]map[string]struct{}     // userID -> conversationIDs
}

func NewTypingTracker() *TypingTracker {
	return &TypingTracker{
		entries: make(map[string]map[string]*typingEntry),
		byUser:  make(map[string]map[string]struct{}),
	}
}

func (t *TypingTracker) Touch(
	conversationID, userID string,
	minInterval time.Duration,
	onExpire func(conversationID, userID string),
) bool {
	if conversationID == "" || userID == "" {
		return false
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	if t.entries[conversationID] == nil {
		t.entries[conversationID] = make(map[string]*typingEntry)
	}
	entry := t.entries[conversationID][userID]
	now := time.Now()
	if entry != nil {
		if now.Sub(entry.lastNotify) < minInterval {
			entry.timer.Reset(TypingTTL)
			return false
		}
		entry.timer.Stop()
	} else {
		entry = &typingEntry{}
		t.entries[conversationID][userID] = entry
	}

	entry.lastNotify = now
	entry.timer = time.AfterFunc(TypingTTL, func() {
		t.Clear(conversationID, userID)
		if onExpire != nil {
			onExpire(conversationID, userID)
		}
	})

	if t.byUser[userID] == nil {
		t.byUser[userID] = make(map[string]struct{})
	}
	t.byUser[userID][conversationID] = struct{}{}
	return true
}

func (t *TypingTracker) Clear(conversationID, userID string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.clearLocked(conversationID, userID)
}

func (t *TypingTracker) clearLocked(conversationID, userID string) {
	if conv := t.entries[conversationID]; conv != nil {
		if entry := conv[userID]; entry != nil && entry.timer != nil {
			entry.timer.Stop()
		}
		delete(conv, userID)
		if len(conv) == 0 {
			delete(t.entries, conversationID)
		}
	}
	if userConvs := t.byUser[userID]; userConvs != nil {
		delete(userConvs, conversationID)
		if len(userConvs) == 0 {
			delete(t.byUser, userID)
		}
	}
}

func (t *TypingTracker) ClearUser(userID string) []string {
	t.mu.Lock()
	defer t.mu.Unlock()
	convs := t.byUser[userID]
	if len(convs) == 0 {
		return nil
	}
	ids := make([]string, 0, len(convs))
	for conversationID := range convs {
		ids = append(ids, conversationID)
		t.clearLocked(conversationID, userID)
	}
	return ids
}
