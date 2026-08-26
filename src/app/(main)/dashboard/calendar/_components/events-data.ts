import { setDate, setHours, setMinutes, startOfMonth } from "date-fns";

const monthStart = startOfMonth(new Date());
const d = (day: number) => setDate(monthStart, day);
const dt = (day: number, hour: number, min = 0) => setMinutes(setHours(setDate(monthStart, day), hour), min);

export type CalendarEntityType = "job" | "survey";
export type JobStatus = "Scheduled" | "In Progress" | "Completed" | "Delayed" | "On Hold" | "Canceled";

export interface DispatchCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  color: string;
  extendedProps: {
    entityType: CalendarEntityType;
    status: JobStatus;
    clientName: string;
    address?: string;
    crew?: string[];
    estimator?: string;
    notes?: string;
  };
}

const jobColor = "var(--chart-2)";
const surveyColor = "var(--chart-4)";

export const dispatchEvents: DispatchCalendarEvent[] = [
  {
    id: "JOB-4001",
    title: "Move: Isabel Moreno",
    start: dt(5, 8),
    end: dt(5, 15),
    color: jobColor,
    extendedProps: {
      entityType: "job",
      status: "Completed",
      clientName: "Isabel Moreno",
      address: "45 Meridian Ave, San Jose",
      crew: ["Tyler Brooks", "Ana Delgado", "Trevor Lang"],
    },
  },
  {
    id: "JOB-4002",
    title: "Move: Danielle Ruiz",
    start: dt(14, 8),
    end: dt(14, 16),
    color: jobColor,
    extendedProps: {
      entityType: "job",
      status: "Completed",
      clientName: "Danielle Ruiz",
      address: "214 Willow Ave, San Jose",
      crew: ["Miguel Santos", "Wesley Grant"],
      notes: "Piano on second floor, extra padding loaded.",
    },
  },
  {
    id: "SUR-5001",
    title: "Survey: Priya Nair",
    start: dt(22, 10),
    end: dt(22, 11),
    color: surveyColor,
    extendedProps: {
      entityType: "survey",
      status: "Scheduled",
      clientName: "Priya Nair",
      address: "77 Alma St, Palo Alto",
      estimator: "Fatima Rahman",
    },
  },
  {
    id: "SUR-5002",
    title: "Survey: Cascade Wealth Advisors",
    start: dt(23, 14),
    end: dt(23, 15, 30),
    color: surveyColor,
    extendedProps: {
      entityType: "survey",
      status: "Scheduled",
      clientName: "Cascade Wealth Advisors",
      address: "400 Concar Dr, San Mateo",
      estimator: "Omar Haddad",
      notes: "Office walk-through after 2 PM only.",
    },
  },
  {
    id: "JOB-4003",
    title: "Move: Harborline Dental Group",
    start: d(24),
    end: d(26),
    allDay: true,
    color: jobColor,
    extendedProps: {
      entityType: "job",
      status: "In Progress",
      clientName: "Harborline Dental Group",
      address: "220 Broadway, Oakland",
      crew: ["Tyler Brooks", "Miguel Santos", "Camille Roux", "Trevor Lang"],
      notes: "Two-day pack, third day load and deliver.",
    },
  },
  {
    id: "SUR-5003",
    title: "Survey: Yusuf Karimi",
    start: dt(26, 9),
    end: dt(26, 10),
    color: surveyColor,
    extendedProps: {
      entityType: "survey",
      status: "Scheduled",
      clientName: "Yusuf Karimi",
      address: "812 Blossom Hill Rd, San Jose",
      estimator: "Sofia Marchetti",
    },
  },
  {
    id: "JOB-4004",
    title: "Move-out: Felix Duarte vault release",
    start: dt(27, 9),
    end: dt(27, 12),
    color: jobColor,
    extendedProps: {
      entityType: "job",
      status: "Scheduled",
      clientName: "Felix Duarte",
      address: "Oakland Warehouse, Rack B",
      crew: ["Julia Ferreira", "Nadia Petrov"],
    },
  },
  {
    id: "SUR-5004",
    title: "Survey: Odessa Fields",
    start: dt(28, 13),
    end: dt(28, 14),
    color: surveyColor,
    extendedProps: {
      entityType: "survey",
      status: "Scheduled",
      clientName: "Odessa Fields",
      address: "930 Coleman Ave, Santa Clara",
      estimator: "Omar Haddad",
    },
  },
  {
    id: "JOB-4005",
    title: "Move: Sasha Petrov",
    start: dt(29, 8),
    end: dt(29, 14),
    color: jobColor,
    extendedProps: {
      entityType: "job",
      status: "Scheduled",
      clientName: "Sasha Petrov",
      address: "88 Alameda de las Pulgas, Redwood City",
      crew: ["Tyler Brooks", "Ana Delgado"],
    },
  },
  {
    id: "JOB-4006",
    title: "Delivery: Owen Fitzgerald move-in",
    start: d(30),
    allDay: true,
    color: jobColor,
    extendedProps: {
      entityType: "job",
      status: "On Hold",
      clientName: "Owen Fitzgerald",
      address: "Fremont Depot, V-301",
      crew: ["Camille Roux"],
      notes: "Waiting on elevator reservation at destination.",
    },
  },
];

export const officeEvents = [
  { title: "Dispatch stand-up", start: dt(2, 7, 30), end: dt(2, 8) },
  { title: "Truck 3 maintenance", start: d(4), allDay: true },
  { groupId: "standup", title: "Dispatch stand-up", start: dt(9, 7, 30), end: dt(9, 8) },
  { title: "Crew safety meeting", start: dt(11, 15), end: dt(11, 16) },
  { title: "Payroll cutoff", start: d(15), allDay: true },
  { groupId: "standup", title: "Dispatch stand-up", start: dt(16, 7, 30), end: dt(16, 8) },
  { title: "Warehouse inspection walk", start: dt(18, 10), end: dt(18, 11, 30) },
  { title: "Storage billing run", start: d(21), allDay: true },
  { groupId: "standup", title: "Dispatch stand-up", start: dt(23, 7, 30), end: dt(23, 8) },
  { title: "All-hands", start: dt(25, 16), end: dt(25, 17) },
  { title: "DOT compliance review", start: dt(28, 9), end: dt(28, 11) },
];
