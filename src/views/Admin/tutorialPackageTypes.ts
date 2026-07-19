export interface TutorialParameter {
  name: string;
  value: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  order: number;
  startTime: number;
  endTime: number;
  shortcuts: string[];
  parameters: TutorialParameter[];
  warnings: string[];
  imageUrl?: string | null;
}

export interface TutorialSection {
  id: string;
  title: string;
  order: number;
  startTime: number;
  endTime: number;
  steps: TutorialStep[];
}

export interface TutorialLesson {
  id: string;
  title: string;
  order: number;
  duration: number;
  tutorialSections: TutorialSection[];
}

export interface TutorialImportResult {
  filename: string;
  success: boolean;
  error?: string;
}

export interface TutorialUploadItem {
  id: string;
  file: File;
  title: string;
}
