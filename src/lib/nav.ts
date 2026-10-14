import {
  LayoutDashboard, ListTodo, ClipboardList, Building2, Briefcase, Users,
  CalendarClock, FileSignature, Contact, UserCheck, Clock, CalendarOff,
  Award, CheckSquare, ShieldCheck, Mail, BarChart3, Settings,
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

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard, roles: ALL, ready: true },
  { label: "My Work", href: "/my-work", icon: ClipboardList, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_executive", "hr_operations", "centre_manager"], ready: false },
  { label: "Task Command Centre", href: "/tasks", icon: ListTodo, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_executive", "hr_operations", "centre_manager"], ready: true },
  { label: "Manpower Planner", href: "/manpower", icon: Building2, roles: ["super_admin", "hr_head", "recruitment_lead", "centre_manager", "leadership"], ready: true },
  { label: "Recruitment", href: "/recruitment", icon: Briefcase, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_executive"], ready: true },
  { label: "Candidates", href: "/candidates", icon: Users, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_executive"], ready: true },
  { label: "Interviews", href: "/interviews", icon: CalendarClock, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_executive", "centre_manager"], ready: true },
  { label: "Offers & Joining", href: "/offers", icon: FileSignature, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_operations"], ready: true },
  { label: "Employee Directory", href: "/employees", icon: Contact, roles: ["super_admin", "hr_head", "hr_executive", "hr_operations", "centre_manager"], ready: false },
  { label: "Onboarding & Offboarding", href: "/onboarding", icon: UserCheck, roles: ["super_admin", "hr_head", "hr_executive", "hr_operations"], ready: false },
  { label: "Attendance", href: "/attendance", icon: Clock, roles: ["super_admin", "hr_head", "hr_operations", "centre_manager"], ready: false },
  { label: "Leave Management", href: "/leave", icon: CalendarOff, roles: ["super_admin", "hr_head", "hr_executive", "hr_operations", "centre_manager"], ready: false },
  { label: "Incentives & Performance", href: "/incentives", icon: Award, roles: ["super_admin", "hr_head", "hr_operations", "centre_manager", "leadership"], ready: false },
  { label: "Approvals", href: "/approvals", icon: CheckSquare, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_operations", "centre_manager"], ready: false },
  { label: "Compliance & Documents", href: "/compliance", icon: ShieldCheck, roles: ["super_admin", "hr_head", "hr_operations"], ready: false },
  { label: "Email Command Centre", href: "/email", icon: Mail, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_executive", "hr_operations"], ready: false },
  { label: "Reports & Analytics", href: "/reports", icon: BarChart3, roles: ["super_admin", "hr_head", "recruitment_lead", "hr_operations", "leadership"], ready: false },
  { label: "Administration & Settings", href: "/admin", icon: Settings, roles: ["super_admin"], ready: false },
];