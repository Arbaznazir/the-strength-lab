package handlers

import "time"

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
