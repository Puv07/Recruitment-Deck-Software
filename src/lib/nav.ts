import {
  LayoutDashboard, ListTodo, Briefcase, Megaphone, Users, CalendarClock,
  FileSignature, CheckSquare, Mail, BarChart3, Settings,
  type LucideIcon,
} from "lucide-react";

export type Role =
  | "super_admin" | "hr_head" | "recruitment_lead" | "hr_executive"
  | "hr_operations" | "centre_manager" | "leadership";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  hr_head: "HR Head / HR Manager",
  recruitment_lead: "Recruitment Lead",
  hr_executive: "HR Executive / Recruiter",
  hr_operations: "HR Operations / Compliance",
  centre_manager: "Centre Manager",
  leadership: "Leadership (Read-Only)",
};

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  ready: boolean; // false = shows a "Soon" tag
};

const ALL: Role[] = [
  "super_admin", "hr_head", "recruitment_lead", "hr_executive",
  "hr_operations", "centre_manager", "leadership",
];

const WORKERS: Role[] = [
  "super_admin", "hr_head", "recruitment_lead", "hr_executive",
  "hr_operations", "centre_manager",
];

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard, roles: ALL, ready: true },
  { label: "Task Command Centre", href: "/tasks", icon: ListTodo, roles: WORKERS, ready: true },
  { label: "Recruitment", href: "/recruitment", icon: Briefcase, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_executive"], ready: true },
  { label: "Job Postings", href: "/postings", icon: Megaphone, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_executive"], ready: true },
  { label: "Candidates", href: "/candidates", icon: Users, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_executive"], ready: true },
  { label: "Interviews", href: "/interviews", icon: CalendarClock, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_executive", "centre_manager"], ready: true },
  { label: "Offers & Joining", href: "/offers", icon: FileSignature, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_operations"], ready: true },
  { label: "Approvals", href: "/approvals", icon: CheckSquare, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_operations", "centre_manager"], ready: true },
  { label: "Email to Tasks", href: "/email", icon: Mail, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_executive", "hr_operations"], ready: false },
  { label: "Reports & Analytics", href: "/reports", icon: BarChart3, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_operations", "leadership"], ready: false },
  { label: "Administration & Settings", href: "/admin", icon: Settings, roles: ["super_admin"], ready: false },
];