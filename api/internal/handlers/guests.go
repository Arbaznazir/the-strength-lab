package handlers

import (
	"sync"
	"time"
)

type GuestTracker struct {
	mu      sync.Mutex
	guests  map[string]time.Time
	ttl     time.Duration
}

func NewGuestTracker() *GuestTracker {
	g := &GuestTracker{
		guests: make(map[string]time.Time),
		ttl:    5 * time.Minute,
	}
	go g.cleanup()
	return g
}

func (g *GuestTracker) Hit(ip string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.guests[ip] = time.Now()
}

func (g *GuestTracker) Count() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	now := time.Now()
	n := 0
	for _, t := range g.guests {
		if now.Sub(t) <= g.ttl {
			n++
		}
	}
	return n
}

func (g *GuestTracker) cleanup() {
	ticker := time.NewTicker(time.Minute)
	for range ticker.C {
		g.mu.Lock()
		now := time.Now()
		for ip, t := range g.guests {
			if now.Sub(t) > g.ttl {
				delete(g.guests, ip)
			}
		}
		g.mu.Unlock()
	}
}
