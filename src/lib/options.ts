// Edit these lists to change the dropdown choices in the Candidates module.
export const SOURCES = [
  "Job portal",
  "Referral",
  "Walk-in",
  "Social media",
  "Consultancy",
  "Campus",
  "Other",
];

export const MARITAL = ["Single", "Married", "Divorced", "Widowed", "Prefer not to say"];

// Suggestions only: the qualification box also accepts anything you type.
export const QUALIFICATION_HINTS = [
  "BPT", "MPT", "BSc", "MSc", "MBBS", "MD", "BDS", "MDS", "B.Com", "BBA", "MBA", "MSW", "Diploma", "12th", "Other",
];

export const CALL_OUTCOMES = [
  "Connected",
  "No answer",
  "Busy",
  "Switched off",
  "Wrong number",
  "Call back requested",
];

export const CALL_RESPONSES = ["Interested", "Not interested", "Thinking", "Needs more information", "Not applicable"];

// Score scale. If you change SCORE_MAX, change SCORE_LEVELS so it has the same number of entries.
// The database accepts values from 1 to 10.
export const SCORE_MAX = 5;
export const SCORE_LEVELS = ["Poor", "Below expectations", "Meets expectations", "Good", "Excellent"];

export const SCORE_CRITERIA = [
  { key: "communication_score", label: "Communication", hint: "Clarity, listening and language" },
  { key: "flexibility_score", label: "Flexibility", hint: "Shifts, locations and adapting to change" },
  { key: "commitment_score", label: "Commitment", hint: "Stability and seriousness about the role" },
  { key: "grooming_score", label: "Grooming standard", hint: "Presentation and professional appearance" },
  { key: "attitude_score", label: "Attitude towards work", hint: "Motivation, openness and teamwork" },
  { key: "technical_score", label: "Technical", hint: "Role knowledge and skills" },
] as const;

export type ScoreKey = (typeof SCORE_CRITERIA)[number]["key"];