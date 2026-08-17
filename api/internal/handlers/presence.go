package handlers

import (
	"sort"
	"time"

	"github.com/thestrengthlab/api/internal/models"
)

// simulatedPresence returns member and guest counts that vary by time of day
// so the community looks active without relying on real last_seen tracking.
func simulatedPresence(totalMembers int, now time.Time) (members, guests int) {
	if totalMembers < 1 {
		totalMembers = 18593
	}

	hour := now.UTC().Hour()
	minute := now.Minute()
	daySeed := now.UTC().YearDay()
	tick := now.Unix() / 30 // shifts every 30 seconds

	var activity float64
	switch {
	case hour >= 16 && hour <= 23:
		activity = 0.014 + float64(hour-16)*0.0008
	case hour >= 10 && hour < 16:
		activity = 0.009
	case hour >= 6 && hour < 10:
		activity = 0.006
	default:
		activity = 0.004
	}

	jitter := 0.85 + float64((int(tick)*13+daySeed)%30)/100.0
	members = int(float64(totalMembers) * activity * jitter)
	members += int(tick%11) - 5 + (now.Second()/15)*2
	if members < 48 {
		members = 48 + int(tick%37)
	}
	if members > 340 {
		members = 280 + int(tick%60)
	}

	guestRatio := 0.20 + float64((int(tick)+minute)%15)/100.0
	guests = int(float64(members) * guestRatio)
	guests += int(tick % 7)
	if guests < 12 {
		guests = 12 + int(tick%28)
	}
	return members, guests
}

// simulatedStaffOnline picks a rotating subset of staff so the sidebar is never
// stuck on "No staff online". Admins sit in ~20 minute on/off windows; mods
// cycle on a slower cadence so someone is usually visible.
func simulatedStaffOnline(all []models.UserPublic, now time.Time) []models.UserPublic {
	if len(all) == 0 {
		return all
	}

	sort.SliceStable(all, func(i, j int) bool {
		if all[i].Role != all[j].Role {
			return all[i].Role < all[j].Role
		}
		return all[i].Username < all[j].Username
	})

	var admins, mods []models.UserPublic
	for _, u := range all {
		if u.Role == "admin" {
			admins = append(admins, u)
		} else {
			mods = append(mods, u)
		}
	}

	out := make([]models.UserPublic, 0, 3)
	seen := map[string]struct{}{}
	add := func(u models.UserPublic) {
		if _, ok := seen[u.ID]; ok {
			return
		}
		seen[u.ID] = struct{}{}
		out = append(out, u)
	}

	// 30-minute cycle: ~20 min with two staff (admin + mod), ~10 min with one.
	cycle := now.Unix() % (30 * 60)
	twoOn := cycle < 20*60
	modSlot := now.Unix() / (8 * 60)

	if twoOn {
		if len(admins) > 0 {
			add(admins[int(now.Unix()/(20*60))%len(admins)])
		}
		if len(mods) > 0 {
			add(mods[int(modSlot)%len(mods)])
		}
		if len(out) < 2 && len(all) >= 2 {
			for _, u := range all {
				if len(out) >= 2 {
					break
				}
				add(u)
			}
		}
	} else if len(mods) > 0 {
		add(mods[int(modSlot)%len(mods)])
	} else if len(admins) > 0 {
		add(admins[0])
	}

	if len(out) == 0 {
		add(all[int(now.Unix()/30)%len(all)])
	}
	return out
}
