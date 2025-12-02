# Matching Algorithm & Scoring Logic

**Status:** Draft 1.1

This document defines how a client must interpret the `survey` array in `profile.json` to calculate a **Compatibility Percentage** between User A (Viewer) and User B (Target).

## 1. The Data Structure

The matching logic relies on the `survey` array found in `profile.json`.

```json
{
  "question_id": "q_ethics_01",
  "answer_choice": "0",
  "importance": "very_important",
  "acceptable_answers": ["0", "1"]
}
```

## 2. Weighting System

Clients must convert the `importance` string into the following integer values for calculation:

| Importance Level     | Point Value | Description         |
| :------------------- | :---------- | :------------------ |
| `mandatory`          | **250**     | Dealbreaker.        |
| `very_important`     | **50**      | Strong preference.  |
| `somewhat_important` | **10**      | Nice to have.       |
| `little_importance`  | **1**       | Minor preference.   |
| `irrelevant`         | **0**       | No impact on score. |

## 3. The Compatibility Formula

The match score is a bidirectional calculation. We calculate how much User B satisfies User A's requirements, and vice versa.

### Step 3.1: Calculate Satisfaction (A -> B)

For every question $Q$ that **both** users have answered:

1.  **Get User A's Weight ($W_a$):** Convert User A's `importance` for $Q$ into an integer.
2.  **Check Match:**
    - Is User B's `answer_choice` present in User A's `acceptable_answers` list?
    - **Yes:** User A earns $W_a$ points.
    - **No:** User A earns 0 points.
3.  **Track Denominator:** Add $W_a$ to User A's `Total_Possible_Points`.

$$ Satisfaction_A = \frac{\sum Points_Earned_A}{\sum Total_Possible_Points_A} $$

### Step 3.2: Calculate Satisfaction (B -> A)

Repeat the process from User B's perspective using User B's importance weights and acceptable answers.

$$ Satisfaction_B = \frac{\sum Points_Earned_B}{\sum Total_Possible_Points_B} $$

### Step 3.3: The Final Geometric Mean

To penalize lopsided matches (where A loves B, but B hates A), use the geometric mean of the two satisfaction scores.

$$ Match\% = \sqrt{Satisfaction_A \times Satisfaction_B} $$

_Example: If A is 90% satisfied, but B is only 50% satisfied, the match score is $\sqrt{0.9 \times 0.5} = \sqrt{0.45} = 67\%$._

## 4. Edge Cases

### 4.1 "Mandatory" Failures

If a user marks a question as `mandatory` (250 points) and the partner's answer is **not** acceptable:

- **Protocol:** The algorithms should strictly treat this as a "Dealbreaker."
- **UI Behavior:** The client usually hides this profile or marks it as "0% Enemy".

### 4.2 No Overlapping Questions

If the set of questions answered by User A and User B has no intersection (count = 0):

- **Result:** Match % cannot be calculated.
- **UI Behavior:** Display as "Unknown Match" or "?".

## 5. Question ID Standardization

To ensure `q_ethics_01` means "Do you return your shopping cart?" for everyone, the Protocol Repository maintains the **Standard Question Bank**.

### 5.1 Standard Question Set
Clients should ingest `https://raw.githubusercontent.com/forkflirt/protocol/main/questions/standard_set.json` to map IDs to human-readable text. This file contains the canonical question definitions with standardized text and answer options.

### 5.2 Question ID Format
- **Standard Questions**: Use prefix format `q_{category}_{number}` (e.g., `q_social_01`, `q_ethics_01`)
- **Custom Questions**: Use prefix `q_custom_{uuid}` for user-defined questions
- **Backwards Compatibility**: Clients must support both standard and custom question formats

### 5.3 Question Categories
Standard questions are organized into categories:
- **social**: Social preferences and interaction styles
- **tech**: Technology-related preferences
- **ethics**: Ethical and moral questions
- **lifestyle**: Lifestyle and daily habit questions

### 5.4 Custom Questions

Users MAY add custom `question_id`s (e.g., `q_custom_uuid`).

- **Scoring**: Custom questions participate in matching scoring like standard questions
- **Display**: If the viewer does not have the question text for that ID in their local database, the question is ignored from scoring but may still be displayed as "Custom Question"
- **Privacy**: Custom questions and answers are still subject to the same encryption and privacy protections as standard questions

## 6. Implementation Details

### 6.1 Minimum Overlap Requirements
Clients must enforce a minimum question overlap for meaningful matching:
- **Default**: 3 overlapping questions required for score calculation
- **Configuration**: Clients may expose this as a user preference
- **UI Display**: Show "Unknown Match" or "?" when minimum overlap is not met

### 6.2 Performance Considerations
- **Caching**: Cache survey mappings for repeated calculations
- **Efficiency**: Use Set data structures for acceptable answer lookups (O(1) complexity)
- **Bidirectional**: Calculate both directions simultaneously when possible

### 6.3 Edge Case Handling
- **Missing Data**: Gracefully handle profiles with incomplete survey data
- **Invalid Importance**: Default invalid importance values to "irrelevant" (0 points)
- **Malformed Data**: Skip malformed survey entries without failing entire calculation

---

And here is the **`questions/standard_set.json`** file mentioned in section 5, so developers actually have data to work with.

```json
[
  {
    "id": "q_social_01",
    "text": "Do you prefer a night out or a night in?",
    "options": [
      { "value": "0", "label": "Night Out (Clubs/Bars)" },
      { "value": "1", "label": "Night In (Books/Movies)" },
      { "value": "2", "label": "A mix of both" }
    ]
  },
  {
    "id": "q_tech_01",
    "text": "Tabs or Spaces?",
    "options": [
      { "value": "0", "label": "Tabs" },
      { "value": "1", "label": "Spaces" },
      { "value": "2", "label": "I don't care / Autoformatter" }
    ]
  },
  {
    "id": "q_ethics_01",
    "text": "Is it okay to pirate abandoned software?",
    "options": [
      { "value": "0", "label": "Yes, always" },
      { "value": "1", "label": "Only if totally unobtainable" },
      { "value": "2", "label": "No, never" }
    ]
  },
  {
    "id": "q_lifestyle_01",
    "text": "How often do you exercise?",
    "options": [
      { "value": "0", "label": "Daily" },
      { "value": "1", "label": "A few times a week" },
      { "value": "2", "label": "Rarely / Never" }
    ]
  }
]
````
