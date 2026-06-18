export const repairIncompleteJson = (jsonStr: string): string => {
  let isString = false;
  let isEscaped = false;
  const stack: string[] = [];

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (char === '\\') {
      isEscaped = true;
      continue;
    }
    if (char === '"') {
      isString = !isString;
      continue;
    }
    if (!isString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}' || char === ']') {
        const expected = char === '}' ? '{' : '[';
        if (stack.length > 0 && stack[stack.length - 1] === expected) {
          stack.pop();
        }
      }
    }
  }

  let repaired = jsonStr;
  if (isString) {
    repaired += '"';
  }

  while (stack.length > 0) {
    const openChar = stack.pop();
    repaired = repaired.trim();

    // Strip trailing colon or commas that would cause parsing issues
    if (repaired.endsWith(':')) {
      repaired = repaired.slice(0, -1).trim();
    }
    if (repaired.endsWith(',')) {
      repaired = repaired.slice(0, -1).trim();
    }

    if (openChar === '{') {
      repaired += '}';
    } else if (openChar === '[') {
      repaired += ']';
    }
  }

  return repaired;
};

export interface PlanSubtask {
  id?: string;
  text: string;
  done: boolean;
}

export interface PlanTask {
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string;
  subtasks: PlanSubtask[];
}

export interface PlanRoadmapStep {
  title: string;
  description: string;
  subtasks: PlanSubtask[];
  order: number;
}

export interface PlanRoadmap {
  title: string;
  description: string;
  steps: PlanRoadmapStep[];
}

export interface PlanJson {
  title: string;
  description: string;
  tags?: string;
  dueDate?: string;
  color?: string;
  tasks: PlanTask[];
  roadmap: PlanRoadmap;
}

// Parse markdown text directly to the JSON plan structure
export const parseMarkdownToPlanJson = (text: string): PlanJson => {
  const lines = text.split(/\r?\n/);
  const parsed: PlanJson = {
    title: '未命名导入项目',
    description: '',
    tasks: [],
    roadmap: {
      title: '学习路线',
      description: '',
      steps: [],
    },
  };

  let currentSection: 'project' | 'tasks' | 'roadmap' | null = 'project';
  let currentRoadmapStep: PlanRoadmapStep | null = null;
  const roadmapSteps: PlanRoadmapStep[] = [];
  let stepOrder = 1;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect section headers
    if (line.startsWith('# ')) {
      if (currentRoadmapStep) {
        roadmapSteps.push(currentRoadmapStep);
        currentRoadmapStep = null;
      }
      parsed.title = line
        .substring(2)
        .replace(/^(?:项目|PROJECT)\s*[:|：]\s*/i, '')
        .trim();
      currentSection = 'project';
      continue;
    } else if (line.startsWith('## ')) {
      if (currentRoadmapStep) {
        roadmapSteps.push(currentRoadmapStep);
        currentRoadmapStep = null;
      }
      const secName = line.substring(3).trim();
      if (
        secName.includes('任务') ||
        secName.includes('看板') ||
        secName.toLowerCase().includes('task') ||
        secName.toLowerCase().includes('kanban')
      ) {
        currentSection = 'tasks';
      } else if (
        secName.includes('学习') ||
        secName.includes('路线') ||
        secName.toLowerCase().includes('roadmap') ||
        secName.toLowerCase().includes('learning')
      ) {
        currentSection = 'roadmap';
        const cleanTitle = secName
          .replace(
            /^(?:学习路线|学习规划|学习大纲|学习路径|学习计划|Roadmap|ROADMAP|Learning\s*Roadmap|Learning\s*Plan)\s*[:|：|\-|\s]\s*/i,
            '',
          )
          .trim();
        if (
          cleanTitle &&
          cleanTitle !== '学习路线' &&
          cleanTitle !== '学习规划' &&
          cleanTitle !== 'Roadmap'
        ) {
          parsed.roadmap.title = cleanTitle;
        }
      } else {
        currentSection = null;
      }
      continue;
    }

    if (currentSection === 'project') {
      if (line.startsWith('描述') || line.startsWith('desc') || line.startsWith('Description')) {
        parsed.description = line.replace(/^(?:描述|desc|Description)\s*[:|：]\s*/i, '').trim();
      } else if (line.startsWith('标签') || line.startsWith('tags') || line.startsWith('Tags')) {
        parsed.tags = line.replace(/^(?:标签|tags|Tags)\s*[:|：]\s*/i, '').trim();
      } else if (line.startsWith('截止') || line.startsWith('due') || line.startsWith('Due')) {
        parsed.dueDate = line.replace(/^(?:截止日期|截止|due|DueDate)\s*[:|：]\s*/i, '').trim();
      } else if (line.startsWith('颜色') || line.startsWith('color') || line.startsWith('Color')) {
        parsed.color = line.replace(/^(?:颜色|color|Color)\s*[:|：]\s*/i, '').trim();
      } else {
        if (parsed.description) {
          parsed.description += '\n' + line;
        } else {
          parsed.description = line;
        }
      }
    } else if (currentSection === 'tasks') {
      const isListItem =
        line.startsWith('- [ ]') || line.startsWith('- [x]') || line.startsWith('- ');
      if (isListItem) {
        const indent = rawLine.length - rawLine.trimStart().length;
        const isNested = indent >= 2;
        if (isNested && parsed.tasks.length > 0) {
          const subtaskText = line
            .replace(/^-\s*\[\s*[ x]?\s*\]\s*/, '')
            .replace(/^-\s*/, '')
            .trim();
          if (subtaskText) {
            const lastTask = parsed.tasks[parsed.tasks.length - 1];
            if (lastTask) {
              if (!lastTask.subtasks) {
                lastTask.subtasks = [];
              }
              lastTask.subtasks.push({
                id: Math.random().toString(36).substring(2, 9),
                text: subtaskText,
                done: false,
              });
            }
          }
        } else {
          // Top-level task
          const content = line
            .replace(/^-\s*\[\s*[ x]?\s*\]\s*/, '')
            .replace(/^-\s*/, '')
            .trim();
          if (!content) continue;

          const parts = content.split('|');
          const taskTitle = (parts[0] || '').trim();
          if (!taskTitle) continue;

          let priority = 'MEDIUM';
          let dueDate = '';
          let description = '';

          for (const rawPart of parts.slice(1)) {
            const part = rawPart.trim();
            if (part.startsWith('优先级') || part.toLowerCase().startsWith('priority')) {
              const pVal = part.replace(/^(?:优先级|priority)\s*[:|：]\s*/i, '').trim();
              if (pVal.includes('低') || pVal.toLowerCase() === 'low') priority = 'LOW';
              else if (pVal.includes('高') || pVal.toLowerCase() === 'high') priority = 'HIGH';
              else if (pVal.includes('紧急') || pVal.toLowerCase() === 'urgent')
                priority = 'URGENT';
              else priority = 'MEDIUM';
            } else if (
              part.startsWith('截止') ||
              part.toLowerCase().startsWith('due') ||
              part.toLowerCase().startsWith('date')
            ) {
              dueDate = part.replace(/^(?:截止|due|date)\s*[:|：]\s*/i, '').trim();
            } else if (part.startsWith('描述') || part.toLowerCase().startsWith('desc')) {
              description = part.replace(/^(?:描述|desc)\s*[:|：]\s*/i, '').trim();
            }
          }

          parsed.tasks.push({
            title: taskTitle,
            description,
            priority,
            dueDate,
            subtasks: [],
          });
        }
      }
    } else if (currentSection === 'roadmap') {
      const clean = line
        .replace(/^[-*\s\d.[\]xX]*\s*/, '') // Remove list bullets, numbers, spaces, and checkboxes
        .replace(/^\*\*?/, '') // Remove leading bold/italic stars
        .trim();
      const isStepHeader =
        line.startsWith('### ') ||
        line.startsWith('#### ') ||
        /^(?:阶段|步骤|Step|Phase|Part)\s*[一二三四五六七八九十\d]/i.test(clean) ||
        /^第\s*[一二三四五六七八九十\d]+\s*(?:阶段|步骤|Step|Phase|Part)/i.test(clean);

      if (isStepHeader) {
        if (currentRoadmapStep) {
          roadmapSteps.push(currentRoadmapStep);
        }

        const stepTitle = line
          .replace(/^(?:###|####)\s*/, '')
          .replace(/^[-*\s\d.[\]xX]*\s*/, '')
          .replace(/^\*\*?/, '')
          .replace(/\*\*?$/, '')
          .trim();

        currentRoadmapStep = {
          title: stepTitle,
          description: '',
          subtasks: [],
          order: stepOrder++,
        };
      } else if (currentRoadmapStep) {
        if (line.startsWith('- [ ]') || line.startsWith('- [x]') || line.startsWith('- ')) {
          const subtaskText = line
            .replace(/^-\s*\[\s*[ x]?\s*\]\s*/, '')
            .replace(/^-\s*/, '')
            .trim();
          if (subtaskText) {
            currentRoadmapStep.subtasks.push({
              id: Math.random().toString(36).substring(2, 9),
              text: subtaskText,
              done: false,
            });
          }
        } else if (
          line.startsWith('描述') ||
          line.startsWith('desc') ||
          line.startsWith('Description')
        ) {
          currentRoadmapStep.description = line
            .replace(/^(?:描述|desc|Description)\s*[:|：]\s*/i, '')
            .trim();
        } else {
          if (currentRoadmapStep.description) {
            currentRoadmapStep.description += '\n' + line;
          } else {
            currentRoadmapStep.description = line;
          }
        }
      }
    }
  }

  if (currentRoadmapStep) {
    roadmapSteps.push(currentRoadmapStep);
  }

  parsed.roadmap.steps = roadmapSteps;

  if (parsed.roadmap) {
    const defaultTitles = ['学习路线', '学习规划', '学习大纲', 'Roadmap', 'ROADMAP'];
    if (!parsed.roadmap.title || defaultTitles.includes(parsed.roadmap.title.trim())) {
      parsed.roadmap.title =
        parsed.title && parsed.title !== '未命名导入项目'
          ? `学习路线 - ${parsed.title}`
          : '项目学习路线';
    }
    if (!parsed.roadmap.description) {
      parsed.roadmap.description =
        parsed.title && parsed.title !== '未命名导入项目'
          ? `针对项目「${parsed.title}」的专属学习路线`
          : '针对本项目的专属学习路线';
    }
  }

  return ensureStableIds(parsed);
};

export const getStableId = (text: string, seed: string): string => {
  let hash = 0;
  const cleanText = text.trim();
  for (let i = 0; i < cleanText.length; i++) {
    hash = (hash << 5) - hash + cleanText.charCodeAt(i);
    hash |= 0;
  }
  return `${seed}-${Math.abs(hash).toString(36)}`;
};

export const ensureStableIds = <T extends PlanJson>(plan: T): T => {
  if (!plan) return plan;
  if (plan.tasks && Array.isArray(plan.tasks)) {
    plan.tasks.forEach((task: PlanTask, tIdx: number) => {
      if (task.subtasks && Array.isArray(task.subtasks)) {
        task.subtasks.forEach((sub: PlanSubtask, sIdx: number) => {
          sub.id = getStableId(sub.text || '', `task-${tIdx}-sub-${sIdx}`);
        });
      }
    });
  }
  if (plan.roadmap && plan.roadmap.steps && Array.isArray(plan.roadmap.steps)) {
    plan.roadmap.steps.forEach((step: PlanRoadmapStep, sIdx: number) => {
      if (step.subtasks && Array.isArray(step.subtasks)) {
        step.subtasks.forEach((sub: PlanSubtask, subIdx: number) => {
          sub.id = getStableId(sub.text || '', `step-${sIdx}-sub-${subIdx}`);
        });
      }
    });
  }
  return plan;
};

// Extract JSON from stream text - robust parser handling code fences and raw JSON
export const extractPlanJson = (fullText: string): { dialogue: string; json: PlanJson | null } => {
  const startMarker = '---PLAN_JSON_START---';
  const startIdx = fullText.indexOf(startMarker);

  if (startIdx === -1) {
    return { dialogue: fullText, json: null };
  }

  const dialogue = fullText.substring(0, startIdx).trim();
  const endMarker = '---PLAN_JSON_END---';
  const endIdx = fullText.indexOf(endMarker);

  let rawJson =
    endIdx !== -1
      ? fullText.substring(startIdx + startMarker.length, endIdx)
      : fullText.substring(startIdx + startMarker.length);

  rawJson = rawJson.trim();
  // Strip code fences if present
  rawJson = rawJson
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
  // Remove any trailing end marker if it crept in
  rawJson = rawJson.replace(/---PLAN_JSON_END---$/, '').trim();

  // Clean up Qwen brackets/formatting
  const firstCurly = rawJson.indexOf('{');
  const lastCurly = rawJson.lastIndexOf('}');

  if (firstCurly !== -1) {
    if (lastCurly !== -1 && lastCurly > firstCurly) {
      rawJson = rawJson.substring(firstCurly, lastCurly + 1);
    } else {
      rawJson = rawJson.substring(firstCurly);
    }
  }

  try {
    return { dialogue, json: ensureStableIds(JSON.parse(rawJson)) };
  } catch {
    // Try to parse repaired JSON if it's incomplete
    try {
      const repaired = repairIncompleteJson(rawJson);
      return { dialogue, json: ensureStableIds(JSON.parse(repaired)) };
    } catch {
      return { dialogue, json: null };
    }
  }
};
