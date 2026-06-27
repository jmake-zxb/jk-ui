import type { App } from 'vue';

import AppIcon from './AppIcon.vue';

export { default as AppIcon } from './AppIcon.vue';

export default {
  install(app: App) {
    app.component('AppIcon', AppIcon);
  },
};
