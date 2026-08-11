package seed

type threadTpl struct {
	title string
	body  string
}

var usernameAdjectives = []string{
	"iron", "heavy", "strong", "raw", "peak", "solid", "steel", "grind", "bar", "rack",
	"power", "dense", "quiet", "fast", "deep", "wide", "tight", "calm", "hard", "lean",
}

var usernameNouns = []string{
	"squat", "bench", "pull", "lifter", "plate", "belt", "chalk", "barbell", "press", "hinge",
	"block", "meet", "rep", "set", "pr", "spot", "coach", "gym", "rack", "lockout",
}

var firstNames = []string{
	"Alex", "Jordan", "Sam", "Casey", "Riley", "Morgan", "Taylor", "Avery", "Quinn", "Drew",
	"Chris", "Pat", "Jamie", "Robin", "Skyler", "Cameron", "Reese", "Blake", "Hayden", "Parker",
	"Kai", "Noah", "Maya", "Elena", "Omar", "Priya", "Luis", "Nina", "Dev", "Sara",
}

var memberTitles = []string{
	"Member", "Intermediate", "Strength nerd", "Meet prep", "Gym rat", "Plate pusher",
	"Form checker", "Quiet grinder", "Weekend warrior", "Comp lifter", "Coach-in-training",
}

var bios = []string{
	"Squat heavy, recover harder.",
	"Chasing numbers without wrecking my joints.",
	"Here for cues, programming, and honest feedback.",
	"Powerlifting + long walks. No fluff.",
	"Training logs and meet reports only.",
	"Former cardio person. Now I deadlift.",
	"Building a base before I peak.",
	"Sleep, protein, and progressive overload.",
}

var threadTemplates = []threadTpl{
	{title: "Week 6 check-in — still progressing?", body: "Running a linear block and wondering when to deload. Posting my working weights below. Critique welcome."},
	{title: "Sumo vs conventional — what fixed your pull?", body: "Switched stances last block. Lockout improved but off the floor got worse. Anyone else?"},
	{title: "Bench stick point at mid-range", body: "Everything flies until midway then dies. Thinking paused work + closer-grip volume. Thoughts?"},
	{title: "First meet attempt selection help", body: "Openers feel easy in the gym. How conservative do you go on platform day?"},
	{title: "Sleep crashed my squat numbers", body: "Two bad nights and my top set fell apart. How do you adjust volume when recovery tanks?"},
	{title: "Accessory work that actually moved my total", body: "Not looking for random machines — what carried over for you on squat/bench/dead?"},
	{title: "Carbs before heavy lower days", body: "Timing and amount. What works when sessions run long?"},
	{title: "Beltless work — how often?", body: "Curious how people program raw work without living in the belt."},
	{title: "Tendon pain on heavy presses", body: "Not acute injury — more nagging. Load management tips that kept you training?"},
	{title: "RPE feeling vs video reality", body: "I keep calling sets @8 that look like @9 on film. Calibration advice?"},
	{title: "4-day upper/lower template tweak", body: "Want more deadlift frequency without frying my back. Share your splits."},
	{title: "Intro: coming back after a long layoff", body: "Been out ~8 months. Restarting light. Looking for realistic week-1 expectations."},
	{title: "Peaking for a local meet — last 3 weeks", body: "How aggressive do you cut volume? Post your peaking outline if you have one."},
	{title: "Protein timing myths — what do you actually do?", body: "Not asking for influencer macros. Practical day-of-lift habits."},
	{title: "Chalk, straps, and grip on heavy pulls", body: "When do you put the straps on? Competing raw — curious about training carryover."},
	{title: "Bloodwork before a bulk — what do you track?", body: "Keeping this evidence-first. Markers that changed how you train or recover?"},
	{title: "Morning sessions feel weak — fixable?", body: "Even after caffeine. Warm-up length? Carb timing? Or just accept nights?"},
	{title: "Paused squat volume block results", body: "Ran 6 weeks of paused work. Depth improved, speed off the chest too. Anyone else?"},
	{title: "Deload week boredom — productive options", body: "Technique drills, mobility, or just walk and shut up?"},
	{title: "Form check request — high-bar squat", body: "Knees cave a bit out of the hole. Cues that stuck for you?"},
	{title: "Weekly challenge idea: AMRAP backdowns", body: "Whoever posts the cleanest set wins bragging rights. Rules in comments."},
	{title: "Supplements that survived my skeptic phase", body: "Creatine stays. Everything else has to earn a slot. What’s still on your shelf?"},
	{title: "Travel week training — minimal equipment", body: "Hotel gym with dumbbells to 50. What would you prioritize for 5 days?"},
	{title: "How long before you trust a new program?", body: "I abandon things too early. What’s your minimum trial block?"},
	{title: "Deadlift fatigue bleeding into squat day", body: "Pull Sunday, squat Tuesday feels cooked. Spacing ideas?"},
}

var replyBodies = []string{
	"This tracked with what I saw last block — volume before intensity fixed it.",
	"Film a side angle next session. Bar path usually tells the story.",
	"I’d drop intensity 5% and keep the reps crisp for two weeks.",
	"Same issue until I added more back-off sets instead of chasing a heavy single.",
	"Sleep and food first. Programming tweaks second.",
	"Have you tried a longer warm-up top set? Helped my morning sessions a lot.",
	"Agree on the pause work. Ugly but it pays rent.",
	"For meet day I’d open lighter than you think. Better to board the train.",
	"Carbs 90 minutes out changed my lower days more than any accessory.",
	"Solid write-up. Bookmarking this for my next deload.",
	"Not convinced yet — can you post weekly tonnage?",
	"I ran something similar and stalled until I cut junk volume.",
	"Cues that helped me: brace hard, then push the floor away.",
	"If tendons are barking, swap a variation for 2–3 weeks instead of grinding.",
	"This is the content I joined for. Thanks for posting numbers.",
	"I’d tag a coach for a second look, but the plan looks sensible.",
	"Same. Night sessions still beat mornings for me.",
	"Try closer grip for a few weeks and reassess the mid-range stick.",
	"Keep it simple. Progressive overload + patience still wins.",
	"Logged. Going to steal the backdown idea for Friday.",
}

var chatLines = []string{
	"Who’s training tonight?",
	"Just hit a clean double. Feeling dangerous.",
	"Deload week brain is real.",
	"Form checks in technique forum — drop a link.",
	"Coffee then squat. Non-negotiable.",
	"Anyone else hate treadmill cardio?",
	"PR Friday incoming or PR Friday coping?",
	"Hydrate or die trying.",
	"That last meet thread was gold.",
	"Quiet grind mode activated.",
	"Belt feels tight — maybe that’s the point.",
	"One more set then I’m out.",
}

var profileLines = []string{
	"Nice progress this block — keep logging.",
	"Welcome to the lab. Introduce yourself in the intro forum if you haven’t.",
	"Solid training consistency. Respect.",
	"That PR thread was inspiring. Let’s go.",
	"If you want a form check buddy, I’m around.",
	"Recover hard this week. You’ve earned it.",
}
