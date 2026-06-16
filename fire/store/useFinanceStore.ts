import { create } from "zustand";

export type Transaction = {
  id: string;
  date: string;
  type: "Income" | "Expense";
  amount: number;
  category: string;
  note: string;
};

export type MonthlyProfit = {
  month: string;
  tradingProfit: number;
  fundingProfit: number;
  airdropProfit: number;
  shopProfit: number;
  otherProfit: number;
};

export type JournalEntry = {
  id: string;
  date: string;
  title: string;
  content: string;
};

export type Settings = {
  fireTarget: number;
  monthlyExpense: number;
  expectedAnnualReturn: number;
};

interface FinanceState {
  transactions: Transaction[];
  monthlyProfits: MonthlyProfit[];
  journalEntries: JournalEntry[];
  settings: Settings;
  baseNetWorth: number;
  
  // Actions
  addTransaction: (tx: Transaction) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  addJournalEntry: (entry: JournalEntry) => void;
}

export const useFinanceStore = create<FinanceState>((set) => ({
  baseNetWorth: 1250000000, // 1.25B base net worth to add with transactions
  transactions: [
    { id: "1", date: "2026-06-01", type: "Income", amount: 50000000, category: "Trading", note: "BTC Long" },
    { id: "2", date: "2026-06-05", type: "Expense", amount: 15000000, category: "Living", note: "Rent & Food" },
    { id: "3", date: "2026-06-10", type: "Income", amount: 12000000, category: "Shop", note: "GoShop Revenue" },
  ],
  monthlyProfits: [
    { month: "Jan 2026", tradingProfit: 45000000, fundingProfit: 5000000, airdropProfit: 0, shopProfit: 12000000, otherProfit: 1000000 },
    { month: "Feb 2026", tradingProfit: 20000000, fundingProfit: 4500000, airdropProfit: 20000000, shopProfit: 13000000, otherProfit: 500000 },
    { month: "Mar 2026", tradingProfit: 55000000, fundingProfit: 5500000, airdropProfit: 5000000, shopProfit: 15000000, otherProfit: 2000000 },
    { month: "Apr 2026", tradingProfit: 30000000, fundingProfit: 6000000, airdropProfit: 0, shopProfit: 11000000, otherProfit: 1500000 },
    { month: "May 2026", tradingProfit: 80000000, fundingProfit: 6500000, airdropProfit: 15000000, shopProfit: 14000000, otherProfit: 3000000 },
    { month: "Jun 2026", tradingProfit: 50000000, fundingProfit: 7000000, airdropProfit: 0, shopProfit: 12000000, otherProfit: 0 },
  ],
  journalEntries: [
    { id: "1", date: "2026-06-01", title: "Market Review", content: "BTC is showing strong momentum. Increased spot allocation." },
    { id: "2", date: "2026-06-15", title: "Mid-month check-in", content: "Expenses are slightly higher than expected. Need to cut down on dining out." }
  ],
  settings: {
    fireTarget: 3000000000, // 3 Billion VND
    monthlyExpense: 20000000, // 20M VND
    expectedAnnualReturn: 12, // 12%
  },
  
  addTransaction: (tx) => set((state) => ({ transactions: [tx, ...state.transactions] })),
  updateSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
  addJournalEntry: (entry) => set((state) => ({ journalEntries: [entry, ...state.journalEntries] })),
}));
