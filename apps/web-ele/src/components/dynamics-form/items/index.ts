import type { App } from 'vue';

import SelectHeader from './common/SelectHeader.vue';
import ArrayObjectCard from './complex/ArrayObjectCard.vue';
import ObjectCard from './complex/ObjectCard.vue';
import TabCard from './complex/TabCard.vue';
import DatePicker from './DatePicker.vue';
import JsonInput from './JsonInput.vue';
import Knowledge from './knowledge/Knowledge.vue';
import SettingLabel from './label/SettingLabel.vue';
import TooltipLabel from './label/TooltipLabel.vue';
import RowLayout from './layout/RowLayout.vue';
import Model from './model/Model.vue';
import MultiRow from './MultiRow.vue';
import PasswordInput from './PasswordInput.vue';
import Radio from './radio/Radio.vue';
import RadioButton from './radio/RadioButton.vue';
import RadioCard from './radio/RadioCard.vue';
import RadioRow from './radio/RadioRow.vue';
import MultiSelect from './select/MultiSelect.vue';
import SingleSelect from './select/SingleSelect.vue';
import Slider from './slider/Slider.vue';
import SwitchInput from './switch/SwitchInput.vue';
import ProgressTableItem from './table/ProgressTableItem.vue';
import TableCheckbox from './table/TableCheckbox.vue';
import TableColumn from './table/TableColumn.vue';
import TableRadio from './table/TableRadio.vue';
import TextareaInput from './TextareaInput.vue';
import TextInput from './TextInput.vue';
import Tree from './tree/Tree.vue';
import TreeSelect from './tree/TreeSelect.vue';
import LocalFileUpload from './upload/LocalFileUpload.vue';
import UploadInput from './upload/UploadInput.vue';

const components: Record<string, any> = {
  TextInput,
  PasswordInput,
  TextareaInput,
  JsonInput,
  MultiRow,
  DatePicker,
  SwitchInput,
  SingleSelect,
  MultiSelect,
  Slider,
  Radio,
  RadioCard,
  RadioButton,
  RadioRow,
  TreeSelect,
  Tree,
  SelectHeader,
  TableColumn,
  TableRadio,
  TableCheckbox,
  ProgressTableItem,
  Model,
  RowLayout,
  TabCard,
  ObjectCard,
  ArrayObjectCard,
  TooltipLabel,
  SettingLabel,
  Knowledge,
  UploadInput,
  LocalFileUpload,
};

const install = (app: App) => {
  Object.keys(components).forEach((key: string) => {
    app.component(key, components[key]);
  });
};

export default { install };
