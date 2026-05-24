import type { App } from 'vue';
import { ElButton } from 'element-plus/es/components/button/index.mjs';
import { ElCheckbox } from 'element-plus/es/components/checkbox/index.mjs';
import { ElColorPicker } from 'element-plus/es/components/color-picker/index.mjs';
import { ElConfigProvider } from 'element-plus/es/components/config-provider/index.mjs';
import { ElDatePicker } from 'element-plus/es/components/date-picker/index.mjs';
import { ElDialog } from 'element-plus/es/components/dialog/index.mjs';
import { ElDivider } from 'element-plus/es/components/divider/index.mjs';
import { ElDrawer } from 'element-plus/es/components/drawer/index.mjs';
import {
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
} from 'element-plus/es/components/dropdown/index.mjs';
import { ElIcon } from 'element-plus/es/components/icon/index.mjs';
import { ElInput } from 'element-plus/es/components/input/index.mjs';
import { ElInputNumber } from 'element-plus/es/components/input-number/index.mjs';
import { ElPagination } from 'element-plus/es/components/pagination/index.mjs';
import { ElPopover } from 'element-plus/es/components/popover/index.mjs';
import { ElRadio, ElRadioButton, ElRadioGroup } from 'element-plus/es/components/radio/index.mjs';
import { ElOption, ElSelect } from 'element-plus/es/components/select/index.mjs';
import { ElSlider } from 'element-plus/es/components/slider/index.mjs';
import { ElSwitch } from 'element-plus/es/components/switch/index.mjs';
import { ElTabPane, ElTabs } from 'element-plus/es/components/tabs/index.mjs';
import { ElTag } from 'element-plus/es/components/tag/index.mjs';
import { ElTooltip } from 'element-plus/es/components/tooltip/index.mjs';

import 'element-plus/theme-chalk/base.css';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/checkbox/style/css';
import 'element-plus/es/components/color-picker/style/css';
import 'element-plus/es/components/config-provider/style/css';
import 'element-plus/es/components/date-picker/style/css';
import 'element-plus/es/components/dialog/style/css';
import 'element-plus/es/components/divider/style/css';
import 'element-plus/es/components/drawer/style/css';
import 'element-plus/es/components/dropdown/style/css';
import 'element-plus/es/components/icon/style/css';
import 'element-plus/es/components/input/style/css';
import 'element-plus/es/components/input-number/style/css';
import 'element-plus/es/components/pagination/style/css';
import 'element-plus/es/components/popover/style/css';
import 'element-plus/es/components/radio/style/css';
import 'element-plus/es/components/select/style/css';
import 'element-plus/es/components/slider/style/css';
import 'element-plus/es/components/switch/style/css';
import 'element-plus/es/components/tabs/style/css';
import 'element-plus/es/components/tag/style/css';
import 'element-plus/es/components/tooltip/style/css';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
import 'element-plus/es/components/notification/style/css';

const components = [
  ElButton,
  ElCheckbox,
  ElColorPicker,
  ElConfigProvider,
  ElDatePicker,
  ElDialog,
  ElDivider,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElOption,
  ElPagination,
  ElPopover,
  ElRadio,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElSlider,
  ElSwitch,
  ElTabPane,
  ElTabs,
  ElTag,
  ElTooltip,
];

export const registerElementPlus = (app: App) => {
  components.forEach((component) => {
    app.use(component);
    if (component && (component as any).name) {
      const name = (component as any).name;
      if (!app.component(name)) {
        app.component(name, component);
      }
    }
  });
};

