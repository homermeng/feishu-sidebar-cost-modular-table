import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      title: 'Copy Records to New Table',
      currentTable: 'Current Table',
      selectedRecords: 'Selected Records',
      records: 'records',
      record: 'Record',
      copy: 'copy',
      clearSelection: 'Clear All',
      clickToSelect: 'Click on records in the table to add them to the selection.',
      newTableName: 'New Table Name',
      enterNewTableName: 'Enter new table name',
      copyToNewTable: 'Copy to New Table',
      copying: 'Copying...',
      noRecordsSelected: 'Please select at least one record',
      enterTableName: 'Please enter a table name',
      processing: 'Processing...',
      ready: 'Ready. Click on records in the table to select them.',
      selectionCleared: 'Selection cleared',
      successMessage: 'Successfully copied {{count}} records to table "{{tableName}}"',
      errorMessage: 'Error: {{error}}',
      operationSuccess: 'Operation completed successfully',
      operationFailed: 'Operation failed',
      initError: 'Initialization failed',
      notInFeishu: 'Please open this plugin in Feishu Bitable to use it.',
      skippedFieldsWarning: 'Note: Some fields could not be copied ({{fields}})'
    }
  },
  zh: {
    translation: {
      title: '复制记录到新表',
      currentTable: '当前表格',
      selectedRecords: '已选记录',
      records: '条',
      record: '记录',
      copy: '副本',
      clearSelection: '清空全部',
      clickToSelect: '点击表格中的记录来添加到选择列表。',
      newTableName: '新表名称',
      enterNewTableName: '请输入新表名称',
      copyToNewTable: '复制到新表',
      copying: '复制中...',
      noRecordsSelected: '请至少选择一条记录',
      enterTableName: '请输入表名',
      processing: '处理中...',
      ready: '就绪。点击表格中的记录来选择它们。',
      selectionCleared: '已清空选择',
      successMessage: '成功复制 {{count}} 条记录到表格 "{{tableName}}"',
      errorMessage: '错误: {{error}}',
      operationSuccess: '操作成功',
      operationFailed: '操作失败',
      initError: '初始化失败',
      notInFeishu: '请在飞书多维表格中打开此插件使用。',
      skippedFieldsWarning: '注意：部分字段无法复制 ({{fields}})'
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: navigator.language.startsWith('zh') ? 'zh' : 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
