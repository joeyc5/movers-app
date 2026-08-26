interface PersonReference {
  name: string;
  role: string;
  initials: string;
}

export interface ProfileDocument {
  id: string;
  name: string;
  category: string;
  updatedAt: string;
  status: "Signed" | "Current";
  isRestricted: boolean;
}

export interface ProfileRecord {
  name: string;
  preferredName: string;
  legalName: string;
  pronouns: string;
  initials: string;
  avatar: string;
  engagementStatus: "Active";
  jobTitle: string;
  jobLevel: string;
  department: string;
  team: string;
  currentProject: string;
  workEmail: string;
  personalEmail: string;
  workPhone: string;
  workplace: string;
  timeZone: string;
  contractorId: string;
  startDate: string;
  engagementLength: string;
  employmentType: string;
  weeklyHours: string;
  schedule: string;
  contractingEntity: string;
  noticePeriod: string;
  dateOfBirth: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  manager: PersonReference;
  bio: string;
  leavePolicy: string;
  annualLeaveAllowance: string;
  remainingLeave: string;
  carriedOverLeave: string;
  usedLeave: string;
  scheduledLeave: string;
  pendingLeaveRequests: string;
  leaveYear: string;
  nextLeave: string;
  lastWorkingDay: string;
  updatedBy: string;
  updatedAt: string;
  documents: ProfileDocument[];
}

export const profile: ProfileRecord = {
  name: "Morgan Ellis",
  preferredName: "Morgan",
  legalName: "Morgan Ellis",
  pronouns: "They / them",
  initials: "ME",
  avatar: "",
  engagementStatus: "Active",
  jobTitle: "Operations Manager",
  jobLevel: "Senior",
  department: "Operations",
  team: "Dispatch & Scheduling",
  currentProject: "Peak Season Readiness",
  workEmail: "morgan.ellis@example.com",
  personalEmail: "m.ellis@example.com",
  workPhone: "+1 (628) 555-0142",
  workplace: "On-site — Warehouse HQ",
  timeZone: "Pacific Time (UTC-7)",
  contractorId: "OPS-2301",
  startDate: "March 3, 2023",
  engagementLength: "3 years, 5 months",
  employmentType: "Contractor",
  weeklyHours: "40 hours",
  schedule: "Monday–Friday · 7:00 AM–4:00 PM",
  contractingEntity: "Self-employed",
  noticePeriod: "14 days",
  dateOfBirth: "June 12, 1988",
  address: "215 Bayshore Ave, Oakland, CA 94621",
  emergencyContact: "Dana Ellis · Spouse",
  emergencyPhone: "+1 (628) 555-0177",
  manager: {
    name: "Devon Park",
    role: "VP of Operations",
    initials: "DP",
  },
  bio: "Morgan runs day-to-day operations: dispatch, warehouse storage, and crew scheduling. Most days start at the dispatch board and end with a walk through the warehouse floor, checking vault occupancy and confirming next week's crews. Morgan works closest with sales during quoting and with the crews once a job is on the calendar.",
  leavePolicy: "Contractor time-off allowance",
  annualLeaveAllowance: "20 days",
  remainingLeave: "12 days",
  carriedOverLeave: "0 days",
  usedLeave: "8 days",
  scheduledLeave: "3 days",
  pendingLeaveRequests: "0",
  leaveYear: "January 1–December 31, 2026",
  nextLeave: "September 14–18, 2026",
  lastWorkingDay: "February 28, 2027",
  updatedBy: "Morgan Ellis",
  updatedAt: "August 10, 2026",
  documents: [
    {
      id: "doc-1",
      name: "Contractor agreement",
      category: "Contract",
      updatedAt: "Mar 3, 2023",
      status: "Signed",
      isRestricted: false,
    },
    {
      id: "doc-2",
      name: "Confidentiality agreement",
      category: "Compliance",
      updatedAt: "Mar 3, 2023",
      status: "Signed",
      isRestricted: true,
    },
    {
      id: "doc-4",
      name: "Safety and handling policy acknowledgement",
      category: "Policy",
      updatedAt: "Jan 8, 2026",
      status: "Current",
      isRestricted: false,
    },
  ],
};
