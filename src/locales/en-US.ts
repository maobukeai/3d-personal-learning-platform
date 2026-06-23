import type { I18nMessages } from '@/types/i18n';

import { commonEn } from './modules/common';
import { settingsEn } from './modules/settings';
import { sidebarEn } from './modules/sidebar';
import { messagesEn } from './modules/messages';
import { teamEn } from './modules/team';
import { dashboardEn } from './modules/dashboard';
import { tasksEn } from './modules/tasks';
import { projectsEn } from './modules/projects';
import { notesEn } from './modules/notes';
import { roadmapsEn } from './modules/roadmaps';
import { academyEn } from './modules/academy';
import { layoutEn } from './modules/layout';
import { searchEn } from './modules/search';
import { assetsEn } from './modules/assets';
import { materialsEn } from './modules/materials';
import { pluginsEn } from './modules/plugins';
import { myWorksEn } from './modules/myWorks';
import { publishDialogEn } from './modules/publishDialog';
import { communityEn } from './modules/community';
import { errorEn } from './modules/error';
import { supportEn } from './modules/support';
import { notificationsEn } from './modules/notifications';
import { toolsEn } from './modules/tools';
import { adminEn } from './modules/admin';

export default {
  common: commonEn,
  settings: settingsEn,
  sidebar: sidebarEn,
  messages: messagesEn,
  team: teamEn,
  dashboard: dashboardEn,
  tasks: tasksEn,
  projects: projectsEn,
  notes: notesEn,
  roadmaps: roadmapsEn,
  academy: academyEn,
  layout: layoutEn,
  search: searchEn,
  assets: assetsEn,
  materials: materialsEn,
  plugins: pluginsEn,
  myWorks: myWorksEn,
  publishDialog: publishDialogEn,
  community: communityEn,
  error: errorEn,
  support: supportEn,
  notifications: notificationsEn,
  tools: toolsEn,
  admin: adminEn,
} satisfies I18nMessages;
