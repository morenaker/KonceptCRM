export const CATEGORIES = [
  { value: "TECHNICAL", label: "Technické služby" },
  { value: "LABORATORY", label: "Laboratoře" },
  { value: "SECURITY", label: "Bezpečnostní služby" },
  { value: "OTHER", label: "Ostatní" },
] as const;

export const STAGES = [
  { value: "NEW", label: "Nový", color: "bg-slate-100 border-slate-300" },
  { value: "CONTACTED", label: "Osloveno", color: "bg-blue-50 border-blue-300" },
  { value: "WAITING", label: "Čeká na odpověď", color: "bg-yellow-50 border-yellow-300" },
  { value: "NEGOTIATION", label: "Jednání", color: "bg-purple-50 border-purple-300" },
  { value: "CLOSED", label: "Uzavřeno", color: "bg-green-50 border-green-300" },
  { value: "REJECTED", label: "Odmítnuto", color: "bg-red-50 border-red-300" },
] as const;

export const ACTIVITY_TYPES = [
  { value: "CALL", label: "Telefonát" },
  { value: "EMAIL", label: "E-mail" },
  { value: "MEETING", label: "Schůzka" },
  { value: "NOTE", label: "Poznámka" },
  { value: "STAGE_CHANGE", label: "Změna fáze" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];
export type StageValue = (typeof STAGES)[number]["value"];
export type ActivityTypeValue = (typeof ACTIVITY_TYPES)[number]["value"];

export const categoryLabel = (v: string) =>
  CATEGORIES.find((c) => c.value === v)?.label ?? v;
export const stageLabel = (v: string) =>
  STAGES.find((s) => s.value === v)?.label ?? v;
export const activityTypeLabel = (v: string) =>
  ACTIVITY_TYPES.find((a) => a.value === v)?.label ?? v;
