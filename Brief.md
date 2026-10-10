Build a polished, real-time webcam hand-tracking game based on the Stroop effect, where players must overcome conflicting visual information to select the correct floating object.

## 1. Core Concept

Three or More colorful 2D screen shape float around the scene.

A target instruction appears at the top of the screen. The text has a color that deliberately contradicts the color name it spells.

For example:

**TARGET:** The word `BLUE` rendered in red.

The correct answer is the **red object**, because the instruction's actual text color is red, regardless of the word `BLUE`.

The player's task is to identify the rendered text color and point their palm toward the matching object.

**Important:** The target is determined by the text's actual rendered color, not the written word.

## 2. Gameplay Loop

### Step 1: Show the Objects

Display three floating geometric objects in distinct colors:

- Blue sphere
- Red pyramid
- Green cube

Give each object a subtle floating animation, slow rotation, and enough spacing to make selection easy.

### Step 2: Display the Conflicting Target

Show a large, highly readable color word near the top of the screen using screen text.

Example:

`TARGET: BLUE`

Render the word `BLUE` in red.

The correct object is the red pyramid.

Generate the word and its rendered color independently so the target can vary between rounds.

### Step 3: Palm Selection

Track the player's palm position using the webcam using Hand Tracker.

The player moves their palm toward the object they believe matches the target's actual text color.

Use a visible, minimal selection indicator around the object nearest to the palm's projected position.

When the palm enters an object's selection radius, briefly highlight it. Require a short, stable hover before confirming the selection to prevent accidental answers caused by hand-tracking jitter.

Do not require a pinch gesture. Palm pointing is the primary interaction.

### Step 4: Give Immediate Feedback

**Correct selection:**

- Display `CORRECT!` or a compact success indicator.
- Trigger a small sparkle burst.
- Make the selected object pop or bounce.
- Award points and advance to the next round.

**Incorrect selection:**

- Display `NOPE`.
- Briefly shake or flash the selected object.
- Deduct a life or apply a small score penalty.
- Allow the player to try again, or advance according to the selected difficulty rules.

Keep feedback brief so the game maintains its pace.

## 3. Target Generation

Create a reliable target generator with two independent variables:

- **Word value:** BLUE, RED, GREEN, YELLOW, PURPLE, and other supported colors.
- **Rendered text color:** A color selected independently from the word value.

For example:

| Displayed word | Actual text color | Correct object |
| -------------- | ----------------- | -------------- |
| BLUE           | Red               | Red            |
| GREEN          | Blue              | Blue           |
| RED            | Green             | Green          |
| YELLOW         | Purple            | Purple         |

Avoid matching the word value and rendered color in the main challenge mode. This preserves the color-conflict mechanic.

Use a consistent color palette across the target text and 3D objects, with sufficiently distinct hues for reliable recognition.

## 4. Visual Direction

Make the experience feel like a premium, minimal arcade game.

- Three-dimensional geometric objects with clean materials.
- Soft lighting, subtle shadows, and gentle floating motion.
- A clean, uncluttered background.
- Large, high-contrast target text.
- Minimal palm cursor or selection ring.
- Crisp success particles and restrained error feedback.
- Smooth transitions between rounds.

The visual challenge should come from the conflicting colors, not from poor readability or distracting effects.

## 5. Progressive Difficulty

**Level 1: Learn the rule**

- Three large, stationary objects.
- One clear target.
- Generous selection radius.
- No time pressure.

**Level 2: Improve reaction**

- Objects move slowly.
- Shorter selection window.
- More frequent color conflicts.

**Level 3: Precision**

- Smaller objects and selection zones.
- Faster movement.
- Shorter target display duration.

**Level 4: Decoys**

- More objects with additional colors.
- Distracting word labels near objects.
- More complex arrangements.
- Optional decoy instructions that test attention without changing the core rule.

Increase difficulty gradually and keep the player's score, streak, and best score visible.

## 6. Technical Requirements

- Use the existing webcam-based hand-tracking system.
- Map palm position to the 3D scene with smooth, low-latency movement.
- Implement proximity-based object selection with stable hover detection.
- Separate the displayed word, rendered text color, and correct answer in the game state.
- Derive the correct answer exclusively from the rendered text color.
- Prevent duplicate answers during one selection.
- Use deterministic round generation for testing.
- Keep animations and feedback lightweight for real-time performance.

## 7. Success Criteria

The rules should be understandable within one round.

Players must learn to ignore what the word says and focus on the color in which it is displayed. Selection should feel responsive and accurate, and the difficulty should increase without making the game feel unfair.

**Design principle: Read the color, not the word. Trust your eyes, not your brain's first instinct.**
