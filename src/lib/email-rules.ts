// Simple keyword rules for suggesting a category, priority and due date. Edit the lists freely.
export const EMAIL_CATEGORIES = [
  "Recruitment",
  "Interview",
  "Offer",
  "Joining",
  "Employee documents",
  "Attendance",
  "Compliance",
  "Approvals",
  "General HR",
  "Unrelated",
];

export const TASK_CATEGORIES = [
  "General",
  "Recruitment follow-up",
  "Missing employee documents",
  "Interview feedback",
  "Joining confirmation",
  "Compliance renewal",
  "Attendance correction",
  "Pending approval",
];

// Which task category each email category maps to
export const TASK_CATEGORY_FOR: Record<string, string> = {
  Recruitment: "Recruitment follow-up",
  Interview: "Interview feedback",
  Offer: "Recruitment follow-up",
  Joining: "Joining confirmation",
  "Employee documents": "Missing employee documents",
  Attendance: "Attendance correction",
  Compliance: "Compliance renewal",
  Approvals: "Pending approval",
  "General HR": "General",
  Unrelated: "General",
};

const RULES: { category: string; words: string[] }[] = [
  { category: "Interview", words: ["interview", "panel", "round", "feedback"] },
  { category: "Offer", words: ["offer letter", "offer", "ctc", "compensation", "salary"] },
  { category: "Joining", words: ["joining", "date of joining", "onboarding", "report on", "induction"] },
  { category: "Employee documents", words: ["document", "certificate", "payslip", "id proof", "aadhaar", "pan card", "experience letter", "relieving"] },
  { category: "Attendance", words: ["attendance", "punch", "biometric", "absent", "late coming", "leave"] },
  { category: "Compliance", words: ["compliance", "licence", "license", "renewal", "inspection", "statutory", "filing", "audit"] },
  { category: "Approvals", words: ["approval", "approve", "sanction", "requisition", "headcount"] },
  { category: "Recruitment", words: ["resume", "cv", "candidate", "vacancy", "job posting", "hiring", "applicant", "referral", "naukri", "indeed"] },
  { category: "General HR", words: ["policy", "employee", "manager", "hr team", "request"] },
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function has(text: string, word: string) {
  const re = new RegExp(`\\b${escapeRegex(word)}${word.length <= 3 ? "\\b" : ""}`, "i");
  return re.test(text);
}

export function classify(subject: string, body: string) {
  const text = body.slice(0, 5000);
  let best: { category: string; score: number; matched: string[] } | null = null;
  for (const rule of RULES) {
    let score = 0;
    const matched: string[] = [];
    for (const w of rule.words) {
      const inSubject = has(subject, w);
      const inBody = has(text, w);
      if (inSubject) score += 3;
      if (inBody) score += 1;
      if (inSubject || inBody) matched.push(w);
    }
    if (score > 0 && (!best || score > best.score)) best = { category: rule.category, score, matched };
  }
  return best ? { category: best.category, matched: best.matched } : { category: "Unrelated", matched: [] as string[] };
}

export function suggestPriority(subject: string, body: string) {
  const m = /\b(urgent|asap|immediately|critical|escalat\w*)/i.exec(`${subject} ${body.slice(0, 3000)}`);
  return m ? { priority: "High", reason: `The email says "${m[1]}"` } : { priority: "Medium", reason: "No urgency words found" };
}

export function suggestDue(priority: string) {
  const days = priority === "Critical" ? 1 : priority === "High" ? 2 : priority === "Low" ? 7 : 5;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

export const cleanSubject = (s: string) => s.replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "").trim();