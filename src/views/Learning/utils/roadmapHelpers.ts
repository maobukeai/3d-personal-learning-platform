import { logError } from '@/utils/error';
import type { RoadmapStep, Course } from '@/types';

export interface StepTask {
  id: string;
  text: string;
}

const KEYWORDS = [
  'three.js',
  'threejs',
  'blender',
  'shader',
  'webgl',
  '3d',
  'modeling',
  '渲染',
  '建模',
  '材质',
  '动画',
  '贴图',
  '灯光',
  '拓扑',
  '骨骼',
  '动力学',
];

export const getRelatedCourses = (step: RoadmapStep, allCourses: Course[]): Course[] => {
  if (!step || !allCourses || allCourses.length === 0) return [];
  const title = step.title.toLowerCase();
  const desc = (step.description || '').toLowerCase();

  return allCourses
    .filter((course) => {
      const courseTitle = course.title.toLowerCase();
      const courseDesc = (course.description || '').toLowerCase();

      for (const kw of KEYWORDS) {
        if (
          (title.includes(kw) || desc.includes(kw)) &&
          (courseTitle.includes(kw) || courseDesc.includes(kw))
        ) {
          return true;
        }
      }

      const words = title.split(/[\s,.\-得的要与及和了与]/).filter((w: string) => w.length > 1);
      for (const w of words) {
        if (courseTitle.includes(w)) {
          return true;
        }
      }
      return false;
    })
    .slice(0, 2);
};

export const getSubTasksForStep = (step: RoadmapStep): StepTask[] => {
  if (!step || !step.subtasks) return [];

  try {
    const parsed = typeof step.subtasks === 'string' ? JSON.parse(step.subtasks) : step.subtasks;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }
    return parsed.map((item, index): StepTask => {
      if (item && typeof item === 'object') {
        const obj = item as { id?: string; text?: string };
        return {
          id: obj.id || `${step.id}_custom_s${index}`,
          text: obj.text || '',
        };
      }
      return {
        id: `${step.id}_custom_s${index}`,
        text: String(item),
      };
    });
  } catch (e) {
    logError(e, { operation: 'roadmap.parseStepSubtasks', component: 'roadmapHelpers' });
    return [];
  }
};
