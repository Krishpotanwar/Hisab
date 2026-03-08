/**
 * Type definitions for database query results
 */

export interface ActivityRecord {
  id: string;
  description: string;
  amount: number;
  date: string;
  paid_by: string;
  category: string;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

export interface SplitWithExpense {
  amount: string | number;
  expenses: {
    paid_by: string;
  };
}

export interface ProfileRecord {
  id: string;
  full_name: string;
  avatar_url: string | null;
  upi_id?: string | null;
}
