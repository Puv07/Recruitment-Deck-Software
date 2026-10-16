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

// Where jobs are posted. Edit this list to match the channels you use.
export const POSTING_PLATFORMS = [
  "Naukri",
  "LinkedIn",
  "Indeed",
  "Apna",
  "WorkIndia",
  "Facebook",
  "Instagram",
  "WhatsApp group",
  "Company website",
  "Employee referral",
  "Walk-in drive",
  "Consultancy",
  "Other",
];

// Why a candidate leaves the pipeline. Edit this list to match your reasons.
export const DROP_REASONS = [
  "Salary expectation",
  "Location or distance",
  "Better offer elsewhere",
  "Not interested",
  "No response",
  "Skills gap",
  "Failed interview",
  "Communication",
  "Notice period too long",
  "Personal or family reasons",
  "Role mismatch",
  "Other",
];

// Reasons shown in the Stage feedback tab. Edit these lists freely.
export const FORWARD_REASONS = [
  "Meets all requirements",
  "Meets requirements, subject to conditions",
  "Strong communication",
  "Strong technical skills",
  "Good cultural fit",
  "Other",
];

export const HOLD_REASONS = [
  "Waiting for another candidate",
  "Waiting for vacancy approval",
  "Candidate unavailable",
  "Salary discussion pending",
  "Documents pending",
  "Other",
];