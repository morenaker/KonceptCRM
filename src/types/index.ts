export type Company = {
  id: string;
  name: string;
  ico: string | null;
  web: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  category: string;
  stage: string;
  notes: string | null;
  followUpDate: string | null;
  lastActivity: string;
  position: number;
  aiAnalysis: string | null;
  aiAnalysisAt: string | null;
  createdAt: string;
  updatedAt: string;
  activities?: Activity[];
};

export type Activity = {
  id: string;
  companyId: string;
  userId: string | null;
  type: string;
  note: string | null;
  date: string;
  user?: { name: string; email: string } | null;
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
  createdAt: string;
};
