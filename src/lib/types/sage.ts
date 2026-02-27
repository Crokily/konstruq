// =============================================================
// Sage Intacct API Types
// XML API: https://developer.intacct.com/api/
// REST API (GA 2025): https://developer.sage.com/intacct/docs/
// Construction module: https://developer.intacct.com/api/construction/
// =============================================================

// --- General Ledger ---
export interface SageGLAccount {
  RECORDNO: number;
  ACCOUNTNO: string;
  TITLE: string;
  ACCOUNTTYPE: string; // 'balancesheet' | 'incomestatement'
  NORMALBALANCE: string; // 'debit' | 'credit'
  CLOSINGTYPE: string;
  STATUS: string; // 'active' | 'inactive'
  CATEGORY: string;
}

export interface SageGLBalance {
  ACCOUNTNO: string;
  TITLE: string;
  DEPARTMENTID: string;
  LOCATIONID: string;
  PERIOD: string;
  DEBITAMOUNT: number;
  CREDITAMOUNT: number;
  ENDINGBALANCE: number;
  CURRENCY: string;
}

export interface SageJournalEntry {
  RECORDNO: number;
  JOURNAL: string;
  BATCH_DATE: string;
  DESCRIPTION: string;
  TOTALENTERED: number;
  STATE: string; // 'Posted' | 'Draft'
  ENTRIES: SageJournalEntryLine[];
}

export interface SageJournalEntryLine {
  ACCOUNTNO: string;
  AMOUNT: number;
  MEMO: string;
  DEPARTMENTID: string;
  PROJECTID: string;
  COSTTYPE: string;
}

// --- Accounts Payable ---
export interface SageAPBill {
  RECORDNO: number;
  VENDORID: string;
  VENDORNAME: string;
  WHENCREATED: string;
  WHENDUE: string;
  TOTALAMOUNT: number;
  TOTALPAID: number;
  TOTALDUE: number;
  STATE: string; // 'Submitted' | 'Approved' | 'Paid'
  PROJECTID: string;
  DESCRIPTION: string;
}

// --- Accounts Receivable ---
export interface SageARInvoice {
  RECORDNO: number;
  CUSTOMERID: string;
  CUSTOMERNAME: string;
  WHENCREATED: string;
  WHENDUE: string;
  TOTALAMOUNT: number;
  TOTALPAID: number;
  TOTALDUE: number;
  STATE: string;
  PROJECTID: string;
  DESCRIPTION: string;
}

// --- Construction Module ---
export interface SageProject {
  PROJECTID: string;
  NAME: string;
  PROJECTCATEGORY: string;
  PROJECTSTATUS: string; // 'In Progress' | 'Completed' | 'Planned'
  BEGINDATE: string;
  ENDDATE: string;
  BUDGETAMOUNT: number;
  CONTRACTAMOUNT: number;
  CUSTOMERID: string;
  CUSTOMERNAME: string;
  DEPARTMENTID: string;
  LOCATIONID: string;
  PARENTID: string;
  DESCRIPTION: string;
}

export interface SageCostType {
  COSTTYPEID: string;
  NAME: string;
  DESCRIPTION: string;
  TASKID: string;
  TASKNAME: string;
  PROJECTID: string;
  PROJECTNAME: string;
  ACCUMULATIONTYPE: string;
  STANDARDCOSTTYPEID: string;
  STATUS: string;
}

export interface SageProjectContract {
  PROJECTCONTRACTID: string;
  NAME: string;
  PROJECTID: string;
  PROJECTNAME: string;
  CONTRACTTYPE: string; // 'Owner' | 'Subcontract'
  TOTALAMOUNT: number;
  BILLEDAMOUNT: number;
  PAIDAMOUNT: number;
  RETAINAGEAMOUNT: number;
  STATUS: string;
  VENDORID: string;
  VENDORNAME: string;
  DESCRIPTION: string;
}

export interface SageProjectEstimate {
  PROJECTESTIMATEID: string;
  PROJECTID: string;
  TASKID: string;
  COSTTYPEID: string;
  ESTIMATEDAMOUNT: number;
  ESTIMATEDUNITS: number;
  POSTED: boolean;
}

export interface SageChangeOrder {
  PROJECTCHANGEORDERID: string;
  PROJECTID: string;
  PROJECTCONTRACTID: string;
  DESCRIPTION: string;
  TOTALAMOUNT: number;
  STATUS: string; // 'Draft' | 'Pending' | 'Approved' | 'Rejected'
  PRICEEFFECTIVEDATE: string;
}

// --- API Auth ---
export interface SageCredentials {
  senderId: string;
  senderPassword: string;
  companyId: string;
  userId: string;
  userPassword: string;
  entityId?: string; // Optional for multi-entity
}

// --- Aging Report (computed) ---
export interface AgingBucket {
  label: string; // 'Current' | '1-30' | '31-60' | '61-90' | '90+'
  amount: number;
  count: number;
}
