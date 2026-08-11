package realtime

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
)

type Hub struct {
	mu      sync.RWMutex
	clients map[*Client]struct{}
}

type Client struct {
	UserID   string
	Username string
	Conn     *websocket.Conn
	Send     chan []byte
}

func NewHub() *Hub {
	return &Hub{clients: make(map[*Client]struct{})}
}

func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
}

func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	if _, ok := h.clients[c]; ok {
		delete(h.clients, c)
		close(c.Send)
	}
	h.mu.Unlock()
}

func (h *Hub) Broadcast(v any) {
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		select {
		case c.Send <- b:
		default:
		}
	}
}

func (h *Hub) SendToUsers(userIDs []string, v any) {
	if len(userIDs) == 0 {
		return
	}
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	targets := make(map[string]struct{}, len(userIDs))
	for _, id := range userIDs {
		if id != "" {
			targets[id] = struct{}{}
		}
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		if _, ok := targets[c.UserID]; !ok {
			continue
		}
		select {
		case c.Send <- b:
		default:
		}
	}
}

func (h *Hub) OnlineUserIDs() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	seen := map[string]struct{}{}
	var ids []string
	for c := range h.clients {
		if c.UserID == "" {
			continue
		}
		if _, ok := seen[c.UserID]; ok {
			continue
		}
		seen[c.UserID] = struct{}{}
		ids = append(ids, c.UserID)
	}
	return ids
}
