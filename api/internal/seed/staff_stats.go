package seed

import "database/sql"

// demoStaffStats are fixed, varied profile numbers for the seeded demo accounts.
// Chosen to feel established without being identical across members.
var demoStaffStats = []struct {
	username                string
	messages, reactions, points, followers int
}{
	{"coach", 2847, 4128, 3654, 1847},
	{"spotter", 1923, 2784, 2416, 1243},
	{"lifter", 1156, 1892, 1428, 687},
}

// boostDemoStaffStats sets authentic-looking engagement stats on coach, spotter, and lifter.
// Bulk seed recomputes counts from posts; this restores the demo profile numbers afterward.
func boostDemoStaffStats(db *sql.DB) error {
	for _, s := range demoStaffStats {
		if _, err := db.Exec(`
			UPDATE users SET
				message_count = $2,
				reaction_score = $3,
				trophy_points = $4,
				follower_count = $5
			WHERE lower(username) = lower($1)
		`, s.username, s.messages, s.reactions, s.points, s.followers); err != nil {
			return err
		}
	}
	return nil
}
