import CodeEditor from './index.vue';

// 自动从组件提取 Props 类型
export type CodeEditorProps = InstanceType<typeof CodeEditor>['$props'];

export { CodeEditor };
export default CodeEditor;
