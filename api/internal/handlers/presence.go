package handlers

import (
	"sort"
	"time"

	"github.com/thestrengthlab/api/internal/models"
)

// simulatedPresence returns member and guest counts that drift every few seconds
// so the community feels busy (roughly 200–500 online, shifting continuously).
func simulatedPresence(totalMembers int, now time.Time) (members, guests int) {
	if totalMembers < 1 {
		totalMembers = 18593
	}

	tick := now.Unix() / 8 // shifts every 8 seconds
	daySeed := now.UTC().YearDay()
	minute := now.Minute()
	second := now.Second()

	// Base total in 200–500 range, stepping with time.
	total := 200 + int((tick*11+int64(daySeed)*3))%31*10
	total += int(tick%9) - 4 + second/20 - 1

	// Slight time-of-day lift (UTC) without leaving the target band.
	hour := now.UTC().Hour()
	switch {
	case hour >= 16 && hour <= 23:
		total += 18
	case hour >= 10 && hour < 16:
		total += 8
	case hour >= 6 && hour < 10:
		total += 4
	}

	total += (minute % 7) - 3
	if total < 198 {
		total = 198 + int(tick%14)
	}
	if total > 512 {
		total = 488 + int(tick%24)
	}

	guestRatio := 0.18 + float64((int(tick)+minute)%14)/100.0
	guests = int(float64(total) * guestRatio)
	guests += int(tick%6) - 2
	if guests < 28 {
		guests = 28 + int(tick%22)
	}
	if guests > total-120 {
		guests = total - 120
	}
	members = total - guests
	if members < 140 {
		members = 140
		guests = total - members
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
