export type ImportMode = 'netdisk' | 'ai_assistant' | 'traditional';

export interface PlanJson {
  title: string;
  description: string;
  tags: string;
  dueDate: string;
  color: string;
  tasks: {
    title: string;
    description?: string;
    priority: string;
    dueDate?: string;
    subtasks?: { id: string; text: string; done: boolean }[];
  }[];
  roadmap?: {
    title: string;
    description?: string;
    steps: {
      title: string;
      description?: string;
      order: number;
      subtasks: { id: string; text: string; done: boolean }[];
    }[];
  };
}

export interface PlanMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  showReasoning?: boolean;
  suggestions?: string[];
  isFallback?: boolean;
}

export interface ParsedNetdisk {
  title: string;
  directories: { name: string; files: string[] }[];
  isFallback?: boolean;
}
