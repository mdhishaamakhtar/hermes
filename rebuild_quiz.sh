#!/bin/bash

# Usage: ./rebuild_quiz.sh <email> <password> [api_base_url]
# Example: ./rebuild_quiz.sh test@example.com password http://localhost:8080

EMAIL=$1
PASSWORD=$2
API_BASE=${3:-"http://localhost:8080"}

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "Usage: $0 <email> <password> [api_base_url]"
  exit 1
fi

echo "Logging in as $EMAIL..."
LOGIN_JSON=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\", \"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_JSON | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Login failed. Payload: $LOGIN_JSON"
  exit 1
fi

echo "Login successful. Creating Event..."

EVENT_JSON=$(curl -s -X POST "$API_BASE/api/events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Indian", "description":"Indian History and Culture"}' )

EVENT_ID=$(echo $EVENT_JSON | grep -o '"id":[0-9]*' | cut -d':' -f2)

if [ -z "$EVENT_ID" ]; then
  echo "Event creation failed. Payload: $EVENT_JSON"
  exit 1
fi

echo "Event created (ID: $EVENT_ID). Creating Quiz..."

QUIZ_JSON=$(curl -s -X POST "$API_BASE/api/events/$EVENT_ID/quizzes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Indian History\", \"displayMode\":\"CODE_DISPLAY\"}")

# Use a more robust regex for ID extraction
QUIZ_ID=$(echo $QUIZ_JSON | sed -E 's/.*"id":([0-9]+).*/\1/')

if [[ ! "$QUIZ_ID" =~ ^[0-9]+$ ]]; then
  echo "Quiz creation failed. Payload: $QUIZ_JSON"
  exit 1
fi

echo "Quiz created (ID: $QUIZ_ID). Adding Questions..."

# --- Standalone Question 1 ---
curl -s -X POST "$API_BASE/api/quizzes/$QUIZ_ID/questions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Who here have been PM?",
    "questionType": "MULTI_SELECT",
    "orderIndex": 1,
    "timeLimitSeconds": 30,
    "displayModeOverride": "LIVE",
    "options": [
      {"text": "Modi", "pointValue": 10, "orderIndex": 0},
      {"text": "Raga", "pointValue": -5, "orderIndex": 1},
      {"text": "Manmohan", "pointValue": 10, "orderIndex": 2},
      {"text": "Mamata", "pointValue": -5, "orderIndex": 3}
    ]
  }' > /dev/null

# --- Passage 1 ---
curl -s -X POST "$API_BASE/api/quizzes/$QUIZ_ID/passages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Ancient India saw the rise of several powerful civilizations and empires. The Indus Valley Civilization (around 2500 BCE) was known for its well-planned cities and advanced drainage systems, but its script remains undeciphered. Later, the Mauryan Empire was established by Chandragupta Maurya in 322 BCE and expanded greatly under Ashoka. After the Kalinga War, Ashoka adopted Buddhism and promoted peace and non-violence through inscriptions across his empire.",
    "orderIndex": 2,
    "timerMode": "PER_SUB_QUESTION",
    "subQuestions": [
      {
        "text": "Based on the passage, select the correct statements.",
        "questionType": "MULTI_SELECT",
        "orderIndex": 0,
        "timeLimitSeconds": 30,
        "options": [
          {"text": "The Indus Valley Civilization had advanced urban planning", "pointValue": 10, "orderIndex": 0},
          {"text": "The script of the Indus Valley Civilization has been decoded", "pointValue": 0, "orderIndex": 1},
          {"text": "Ashoka adopted Buddhism after the Kalinga War", "pointValue": 10, "orderIndex": 2},
          {"text": "Chandragupta Maurya was a ruler of the Indus Valley Civilization", "pointValue": 0, "orderIndex": 3}
        ]
      },
      {
        "text": "Based on the passage, select the correct statements.",
        "questionType": "MULTI_SELECT",
        "orderIndex": 1,
        "timeLimitSeconds": 30,
        "options": [
          {"text": "The Mauryan Empire began before the Indus Valley Civilization", "pointValue": 10, "orderIndex": 0},
          {"text": "Ashoka promoted non-violence after a major war", "pointValue": 0, "orderIndex": 1},
          {"text": "Indus Valley cities had poor drainage systems", "pointValue": 10, "orderIndex": 2},
          {"text": "Ashoka used inscriptions to spread his ideas", "pointValue": 0, "orderIndex": 3}
        ]
      }
    ]
  }' > /dev/null

# --- Passage 2 ---
curl -s -X POST "$API_BASE/api/quizzes/$QUIZ_ID/passages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The Gupta Empire (around 4th–6th century CE) is often called the Golden Age of ancient India. During this period, there were great advancements in science, mathematics, and literature. Scholars like Aryabhata contributed significantly to mathematics and astronomy. The concept of zero and the decimal system developed during this time influenced later civilizations.",
    "orderIndex": 3,
    "timerMode": "ENTIRE_PASSAGE",
    "timeLimitSeconds": 300,
    "subQuestions": [
      {
        "text": "Select the correct statements:",
        "questionType": "MULTI_SELECT",
        "orderIndex": 0,
        "options": [
          {"text": "The Gupta period is known as a golden age", "pointValue": 10, "orderIndex": 0},
          {"text": "Aryabhata was a ruler of the Gupta Empire", "pointValue": 0, "orderIndex": 1},
          {"text": "Major progress was made in science and mathematics", "pointValue": 10, "orderIndex": 2},
          {"text": "The concept of zero developed during this time", "pointValue": 10, "orderIndex": 3}
        ]
      },
      {
        "text": "Who was a famous mathematician of this period?",
        "questionType": "SINGLE_SELECT",
        "orderIndex": 1,
        "options": [
          {"text": "Ashoka", "pointValue": 0, "orderIndex": 0},
          {"text": "Aryabhata", "pointValue": 1, "orderIndex": 1},
          {"text": "Chandragupta", "pointValue": 0, "orderIndex": 2},
          {"text": "Harsha", "pointValue": 0, "orderIndex": 3}
        ]
      }
    ]
  }' > /dev/null

echo "Done! Event '$EVENT_ID' with Quiz '$QUIZ_ID' created and questions added."
