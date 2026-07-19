export interface TutorialParameter {
  name: string;
  value: string;
}

export interface TutorialStepInput {
  order: number;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  screenshotTime?: number;
  shortcuts: string[];
  parameters: TutorialParameter[];
  warnings: string[];
  imageEntry?: string;
}

export interface TutorialSectionInput {
  order: number;
  title: string;
  startTime: number;
  endTime: number;
  steps: TutorialStepInput[];
}

export interface ParsedTutorialPackage {
  title: string;
  summary: string;
  sections: TutorialSectionInput[];
  getEntryBuffer(entryPath: string): Promise<Buffer>;
}

export interface StoredTutorialImage {
  url: string;
  key: string;
  size: number;
  storageConfigId: string;
}
