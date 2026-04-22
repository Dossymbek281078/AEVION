export type Account = {
  id: string;
  owner: string;
  balance: number;
  createdAt: string;
};

export type Operation = {
  id: string;
  kind: "topup" | "transfer";
  amount: number;
  from: string | null;
  to: string;
  createdAt: string;
};

export type Me = {
  id: string;
  email: string;
  name: string;
  role: string;
};
