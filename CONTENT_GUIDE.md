# ✏️ Content Guide — Editing Soccer Brain with Claude Desktop

This guide explains how to update game content using Claude Desktop (no coding or API needed).

---

## What You Can Edit

Everything in `scenarios.json` controls the game:
- **Scenarios** — the actual questions and challenges
- **Coach messages** — what the coach says when correct/wrong
- **Levels** — the level names, required scores, and time limits
- **Player names** — the teammate and opponent names on the field

---

## How to Edit with Claude Desktop

### Method 1: Ask Claude to Edit Directly

1. Open **Claude Desktop**
2. Open the `scenarios.json` file by dragging it into the chat, or use:
   > "Open the file at [path to your scenarios.json]"
3. Ask Claude what you want to change. Examples below.

---

## Example Prompts to Use with Claude Desktop

### ➕ Add a New Scenario

> "Add a new choice scenario to scenarios.json about what to do when you receive a pass with your back to goal. Make it difficulty 2, category 'positioning'. Give it 4 choices with one correct answer."

> "Add a new 'spot' scenario where the player has to find the open teammate in a crowded midfield. Use difficulty 1."

> "Add a reaction scenario with 10 steps in the sequence. Make it harder than the existing ones."

### ✏️ Change an Existing Scenario

> "In scenarios.json, change the question for scenario s002 to make it simpler for an 8-year-old. Keep the same answer choices."

> "Make scenario s006 easier — change the difficulty to 1 and simplify the question language."

> "In scenario s004, change the teammate names to Emma, Olivia, and Grace."

### 🗑️ Remove a Scenario

> "Remove scenario s007 from scenarios.json."

### 🎙️ Update Coach Messages

> "Add 3 more encouragement messages to the coach in scenarios.json. Make them fun and energetic for an 8-year-old girl."

> "Change the coach name from 'Coach Zara' to 'Coach Maria'."

### ⏱️ Adjust Difficulty / Timing

> "Change the Champion level time limit from 12 seconds to 15 seconds in scenarios.json."

> "Lower the minimum score for the Striker level from 150 to 100."

### 🌍 Change Player Names

> "Update all teammate names in scenarios.json to be: Mia, Zara, Priya, Luna, and Jade."

---

## After Editing

1. **Save** the updated `scenarios.json`
2. **Upload it** to your GitHub repository (replace the old file)
3. GitHub Pages will serve the new content automatically within a minute or two
4. **Test** by opening your game URL and playing a round

---

## Scenario Types Reference

### `choice` — Pick the best option
```json
{
  "id": "s011",
  "type": "choice",
  "category": "passing",       ← passing, shooting, defending, positioning, awareness
  "difficulty": 1,             ← 1 (easy), 2 (medium), 3 (hard)
  "question": "Your question here...",
  "fieldSetup": {
    "ballPosition": {"x": 50, "y": 55},
    "yourPlayer": {"x": 50, "y": 55, "label": "YOU"},
    "teammates": [
      {"x": 25, "y": 40, "label": "Mia", "isOpen": true},
      {"x": 70, "y": 65, "label": "Zara", "isOpen": false}
    ],
    "defenders": [
      {"x": 50, "y": 42, "label": "D1"}
    ],
    "goal": {"x": 50, "y": 10}
  },
  "choices": [
    {"id": "A", "text": "Option A text", "correct": true,  "explanation": "Why this is right"},
    {"id": "B", "text": "Option B text", "correct": false, "explanation": "Why this is wrong"},
    {"id": "C", "text": "Option C text", "correct": false, "explanation": "Why this is wrong"},
    {"id": "D", "text": "Option D text", "correct": false, "explanation": "Why this is wrong"}
  ]
}
```

**Field coordinates**: x and y are percentages (0-100) of the field width/height.
- Top of field = y: 0–15 (where the goal is)
- Bottom = y: 85–100
- Left = x: 0, Right = x: 100, Centre = x: 50

### `spot` — Tap the right player
```json
{
  "id": "s012",
  "type": "spot",
  "category": "awareness",
  "difficulty": 1,
  "question": "Tap the most open teammate!",
  "timeLimit": 15,
  "fieldSetup": { ... same as above, but teammates need "id" fields ... },
  "correctTeammateId": "t1",   ← must match the "id" of the correct teammate
  "explanation": "Why that player was the right choice"
}
```

### `reaction` — Tap the green, ignore the red
```json
{
  "id": "s013",
  "type": "reaction",
  "category": "speed",
  "difficulty": 1,
  "question": "TAP when you see GREEN!",
  "sequence": [
    {"color": "red",   "duration": 800},   ← duration in milliseconds
    {"color": "green", "duration": 1200},
    {"color": "red",   "duration": 600},
    {"color": "green", "duration": 1000}
  ]
}
```

---

## Tips for Writing Good Scenarios

1. **Keep questions short** — one or two sentences max for an 8-year-old
2. **One clearly correct answer** — avoid ambiguity
3. **Explanations teach** — explain WHY the answer is right in simple terms
4. **Mix categories** — include passing, shooting, defending, positioning, and reaction
5. **Vary difficulty** — most scenarios should be difficulty 1 or 2
6. **Real soccer situations** — base scenarios on things that actually happen in youth games

---

## Difficulty Levels & Time Limits

| Level | Emoji | Min Score | Time Limit |
|-------|-------|-----------|------------|
| Grasshopper | 🌱 | 0 | 30s |
| Striker | ⚡ | 150 | 20s |
| Champion | 🏆 | 350 | 12s |

Players start at Grasshopper. As their score climbs past 150 the timer tightens to 20s, and past 350 it drops to 12s — so the game gets harder the better they play.

For individual `spot` scenarios you can set a custom `timeLimit` in seconds. Recommended defaults: difficulty 1 → 15s, difficulty 2 → 12s.

---

## Need Help?

Ask Claude Desktop to help you with any of this. For example:

> "Help me think of 5 new soccer decision scenarios appropriate for an 8-year-old girl. Then add them to scenarios.json."
