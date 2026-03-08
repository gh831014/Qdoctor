export enum ProblemType {
  TASK = "任务型",
  KNOWLEDGE = "知识型",
  LOGIC = "逻辑判断",
}

export interface FiveWOneH {
  what: string;
  why: string;
  when: string;
  who: string;
  where: string;
  how: string;
  coreProblems: string[];
  problemType: ProblemType;
}

export interface ExhaustionElement {
  category: string;
  elements: string[];
}

export interface InductionResult {
  commonalities: string[];
  rootCauses: string[];
}

export interface DeductionSolution {
  logic: string;
  solution: string;
}

export interface LogicCheckResult {
  item: string;
  passed: boolean;
  reason?: string;
}

export interface TaskStep {
  step: string;
  tasks: {
    role: string;
    action: string;
  }[];
}

export interface KnowledgePoint {
  name: string;
  summary: string;
  attributes: {
    label: string;
    value: string;
  }[];
}

export interface AnalysisData {
  fiveWOneH: FiveWOneH;
  exhaustion: ExhaustionElement[];
  induction: InductionResult;
  deduction: DeductionSolution[];
  logicCheck: LogicCheckResult[];
  taskDecomposition?: TaskStep[];
  knowledgePoints?: KnowledgePoint[];
}

export interface HistoryItem {
  id: number | string;
  title: string;
  original_problem: string;
  analysis_data: string | any; // JSON string or object
  created_at: string;
}
