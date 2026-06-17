export type Dict<T> = Record<string, T>;

interface ViewCardItem {
  type: 'default' | 'eval';
  title: string;
  value_field: string;
}

interface TableColumn {
  property: string;
  label: string;
  value_field?: string;
  attrs?: Attrs;
  type: 'component' | 'default' | 'eval';
  props_info?: PropsInfo;
}

interface ColorItem {
  color: string;
  percentage: number;
}

interface Attrs {
  placeholder?: string;
  labelWidth?: string;
  labelSuffix?: string;
  requireAsteriskPosition?: 'left' | 'right';
  color?: Array<ColorItem>;
  [propName: string]: any;
}

interface PropsInfo {
  view_card?: Array<ViewCardItem>;
  table_columns?: Array<TableColumn>;
  active_msg?: string;
  style?: Dict<any>;
  item_style?: Dict<any>;
  rules?: Dict<any>;
  err_msg?: string;
  tabs_label?: string;
  [propName: string]: any;
}

interface FormField {
  field: string;
  input_type: string;
  label?: any | string;
  required?: boolean;
  default_value?: any;
  show_default_value?: boolean;
  relation_show_field_dict?: Dict<Array<any>>;
  relation_trigger_field_dict?: Dict<any>;
  trigger_type?: 'CHILD_FORMS' | 'OPTION_LIST';
  attrs?: Attrs;
  props_info?: PropsInfo;
  text_field?: string;
  value_field?: string;
  option_list?: Array<any>;
  provider?: string;
  method?: string;
  children?: Array<FormField>;
  required_asterisk?: boolean;
  visibility_rules?: {
    [key: string]: any;
    node_id?: string;
    node_name?: string;
  };
  [propName: string]: any;
}

export type { FormField };
