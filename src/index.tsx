(window as any).__COZE_API_TOKEN =
  "sat_IInQlOyLHwxM0IsOEbi3WETZ1pe77AIdTQ9aOtc6Lb9bJPrmCBzmL7ybSfdk0gmd";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  bitable,
  IFieldMeta,
  FieldType,
  ISingleSelectField,
  IMultiSelectField,
} from "@lark-base-open/js-sdk";
import {
  Button,
  message,
  Spin,
  Card,
  Typography,
  Space,
  Input,
  Alert,
  Tag,
} from "antd";
import { useTranslation } from "react-i18next";
import { CozeAPI } from "@coze/api";
import "./i18n";

const { Title, Text } = Typography;

const SKIP_FIELD_TYPES = [
  FieldType.Formula,
  FieldType.Lookup,
  FieldType.CreatedTime,
  FieldType.ModifiedTime,
  FieldType.CreatedUser,
  FieldType.ModifiedUser,
  FieldType.AutoNumber,
];

interface SelectedRecord {
  id: string;
  displayText: string;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LoadApp />
  </React.StrictMode>,
);

function LoadApp() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [tableName, setTableName] = useState("");
  const [selectedRecords, setSelectedRecords] = useState<SelectedRecord[]>([]);
  const [newTableName, setNewTableName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">(
    "info",
  );

  const [table, setTable] = useState<any>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const currentTable = await bitable.base.getActiveTable();
        const name = await currentTable.getName();
        setTable(currentTable);
        setTableName(name);
        setNewTableName(`${name}_${t("copy")}`);
        setStatusMessage(t("ready"));
        setStatusType("info");

        const fieldMetaList = await currentTable.getFieldMetaList();
        const selectedMeta = fieldMetaList.find(
          (f) =>
            f.name.toLowerCase() === "selected" &&
            f.type === FieldType.Checkbox,
        );
        if (selectedMeta) {
          setSelectedFieldId(selectedMeta.id);
        } else {
          setStatusMessage(t("ready") + "（未检测到 'selected' 复选框字段）");
        }
      } catch (error: any) {
        console.error("Init error:", error);
        if (error?.message === "time out" || error === "time out") {
          setStatusMessage(t("notInFeishu"));
          setStatusType("info");
        } else {
          setStatusMessage(t("initError"));
          setStatusType("error");
        }
      }
    };
    init();
  }, [t]);

  const refreshSelectedByCheckbox = async () => {
    if (!table || !selectedFieldId) {
      message.warning("未找到 'selected' 复选框字段或表格未加载");
      return;
    }
    setLoading(true);
    try {
      let selection: { viewId?: string | null } = {};
      try {
        selection = (await bitable.base.getSelection()) || {};
      } catch (e) {
        console.warn("getSelection failed:", e);
      }
      let recordIdList: string[] = [];
      if (selection.viewId) {
        try {
          const view = await table.getViewById(selection.viewId);
          recordIdList = await view.getVisibleRecordIdList();
        } catch (e) {
          console.warn(
            "getVisibleRecordIdList failed, fallback to all records",
            e,
          );
        }
      }
      if (recordIdList.length === 0) {
        recordIdList = await table.getRecordIdList();
      }
      const field = await table.getFieldById(selectedFieldId);
      const newSelected: SelectedRecord[] = [];
      let count = 1;
      for (const recordId of recordIdList) {
        const value = await field.getValue(recordId);
        if (value === true) {
          newSelected.push({
            id: recordId,
            displayText: `${t("record")} ${count++}`,
          });
        }
      }
      setSelectedRecords(newSelected);
      setStatusMessage(
        newSelected.length > 0
          ? `${t("selectedRecords")}: ${newSelected.length} ${t("records")}`
          : t("clickToSelect"),
      );
      setStatusType("info");
      message.success(`已刷新，共选中 ${newSelected.length} 条记录`);
    } catch (error) {
      console.error("刷新选中记录失败:", error);
      message.error("刷新失败");
    } finally {
      setLoading(false);
    }
  };

  const removeRecord = (recordId: string) => {
    setSelectedRecords((prev) => prev.filter((r) => r.id !== recordId));
  };

  const clearSelection = () => {
    setSelectedRecords([]);
    setStatusMessage(t("selectionCleared"));
    setStatusType("info");
  };

  // Coze API helper function to duplicate a table
  const duplicateTableWithCoze = async (
    tableUrl: string,
  ): Promise<string | null> => {
    try {
      // Try to get token from window object (will be injected at runtime)
      const token =
        (window as any).__COZE_API_TOKEN || (window as any).COZE_API_TOKEN;
      if (!token) {
        console.warn(
          "[Coze] COZE_API_TOKEN not found. Using original URL.",
        );
        return null;
      }

      console.log(`[Coze] Starting duplication for: ${tableUrl.substring(0, 50)}...`);

      const apiClient = new CozeAPI({
        token,
        baseURL: "https://api.coze.cn",
      });

      // Fixed input folder URL
      const inputFolderUrl =
        "https://ycnlvj3d3e9f.feishu.cn/drive/folder/EZu5fIkOBlPg89dPa65c9QvXnue?from=space_personal_filelist&fromShareWithMeNew=1";

      const res = await apiClient.workflows.runs.stream({
        workflow_id: "7585399127100981254",
        parameters: {
          input_folder_url: inputFolderUrl,
          input_table_url: tableUrl,
        },
      });

      // Extract output URL from response
      for await (const event of res as any) {
        console.log("[Coze] Full event:", JSON.stringify(event).substring(0, 500));
        
        // Try both event.message and direct event structure
        const messageData = event?.message || event;
        
        if (messageData && typeof messageData === "object") {
          const msg = messageData as any;
          console.log("[Coze] Message node_title:", msg.node_title, "node_id:", msg.node_id);
          
          // Check for End node
          if (msg.node_title === "End" || msg.node_id === 900001) {
            console.log("[Coze] Found End node, content type:", typeof msg.content);
            if (msg.content) {
              try {
                let contentData = msg.content;
                
                // Parse content if it's a string
                if (typeof contentData === "string") {
                  console.log("[Coze] Parsing string content:", contentData.substring(0, 200));
                  contentData = JSON.parse(contentData);
                } else {
                  console.log("[Coze] Content is already an object:", contentData);
                }
                
                console.log("[Coze] Final contentData:", JSON.stringify(contentData).substring(0, 300));
                
                // Extract output - ensure it's a string URL
                let outputUrl: string | null = null;
                
                if (typeof contentData === "string") {
                  // contentData is already the URL string
                  outputUrl = contentData;
                } else if (contentData.output) {
                  // Extract output field and force to string
                  if (typeof contentData.output === "string") {
                    outputUrl = contentData.output;
                  } else if (typeof contentData.output === "object") {
                    // If it's an object, convert to string
                    outputUrl = String(contentData.output);
                  }
                }
                
                // Final validation: ensure we have a string URL
                if (outputUrl && typeof outputUrl === "string" && outputUrl.includes("feishu")) {
                  console.log("[Coze] Successfully extracted URL:", outputUrl.substring(0, 50));
                  return outputUrl;
                } else {
                  console.warn("[Coze] Could not extract valid URL, got:", outputUrl);
                  console.log("[Coze] Full contentData for debugging:", JSON.stringify(contentData));
                }
              } catch (parseError) {
                console.warn("[Coze] Parse error:", parseError, "content was:", msg.content);
              }
            }
          }
        }
      }

      console.warn("[Coze] No output URL found in response");
      return null;
    } catch (error) {
      console.error("[Coze] Error:", error);
      return null;
    }
  };

  const copyToNewTable = async () => {
    if (selectedRecords.length === 0) {
      message.warning(t("noRecordsSelected"));
      return;
    }
    if (!newTableName.trim()) {
      message.warning(t("enterTableName"));
      return;
    }
    setLoading(true);
    setStatusMessage(t("processing"));
    setStatusType("info");

    try {
      let selection: { tableId?: string | null; viewId?: string | null } = {};
      try {
        selection = (await bitable.base.getSelection()) || {};
      } catch (e) {
        console.warn("getSelection failed, will fallback to active table:", e);
      }
      const sourceTable =
        selection.tableId && selection.tableId !== null
          ? await bitable.base.getTableById(selection.tableId)
          : await bitable.base.getActiveTable();
      const tableFieldMetaList: IFieldMeta[] =
        await sourceTable.getFieldMetaList();
      const fieldCache: Map<string, any> = new Map();
      for (const fieldMeta of tableFieldMetaList) {
        const field = await sourceTable.getFieldById(fieldMeta.id);
        fieldCache.set(fieldMeta.id, field);
      }

      let orderedFieldMetaList: IFieldMeta[] = tableFieldMetaList.slice();
      if (selection.viewId) {
        try {
          const view = await sourceTable.getViewById(selection.viewId);
          if (view && typeof view.getFieldMetaList === "function") {
            const viewFieldMetaList: IFieldMeta[] =
              await view.getFieldMetaList();
            if (viewFieldMetaList && viewFieldMetaList.length > 0) {
              const nameToTableMeta = new Map<string, IFieldMeta>();
              tableFieldMetaList.forEach((fm) =>
                nameToTableMeta.set(fm.name, fm),
              );
              const inViewOrdered: IFieldMeta[] = [];
              const addedNames = new Set<string>();
              for (const vfm of viewFieldMetaList) {
                const tm = nameToTableMeta.get(vfm.name);
                if (tm) {
                  inViewOrdered.push(tm);
                  addedNames.add(tm.id);
                } else {
                  if ((vfm as any).id) {
                    const tmById = tableFieldMetaList.find(
                      (x) => x.id === (vfm as any).id,
                    );
                    if (tmById) {
                      inViewOrdered.push(tmById);
                      addedNames.add(tmById.id);
                      continue;
                    }
                  }
                  inViewOrdered.push(vfm);
                  if ((vfm as any).id) addedNames.add((vfm as any).id);
                }
              }
              for (const tm of tableFieldMetaList) {
                if (!addedNames.has(tm.id)) {
                  inViewOrdered.push(tm);
                }
              }
              orderedFieldMetaList = inViewOrdered;
            }
          }
        } catch (e) {
          console.warn(
            "getViewById/getFieldMetaList failed, fallback to table fields:",
            e,
          );
        }
      }

      const skippedFields: string[] = [];
      const initialFields: any[] = [];
      let sourcePrimaryFieldId: string | null = null;
      for (const fm of tableFieldMetaList) {
        if ((fm as any).is_primary || (fm as any).isPrimary) {
          sourcePrimaryFieldId = fm.id;
          break;
        }
      }
      if (!sourcePrimaryFieldId) {
        for (const fm of orderedFieldMetaList) {
          if (!SKIP_FIELD_TYPES.includes(fm.type)) {
            sourcePrimaryFieldId = fm.id;
            break;
          }
        }
      }
      const primaryFieldMeta = sourcePrimaryFieldId
        ? tableFieldMetaList.find((f) => f.id === sourcePrimaryFieldId) || null
        : null;

      const buildFieldConfig = (fieldMeta: IFieldMeta) => {
        const cfg: any = {
          name: fieldMeta.name,
          type: fieldMeta.type,
        };
        if ((fieldMeta as any).property) {
          const prop = { ...(fieldMeta as any).property };
          delete prop.fieldId;
          delete prop.tableId;
          cfg.property = prop;
        }
        return cfg;
      };

      if (primaryFieldMeta) {
        try {
          if (SKIP_FIELD_TYPES.includes(primaryFieldMeta.type)) {
            skippedFields.push(primaryFieldMeta.name);
          } else {
            const primaryCfg = buildFieldConfig(primaryFieldMeta);
            primaryCfg.is_primary = true;
            primaryCfg.isPrimary = true;
            initialFields.push(primaryCfg);
          }
        } catch (e) {
          console.warn(
            `Could not prepare primary field ${primaryFieldMeta.name}:`,
            e,
          );
          skippedFields.push(primaryFieldMeta.name);
        }
      }

      for (const fm of orderedFieldMetaList) {
        if (fm.id === sourcePrimaryFieldId) continue;
        if (SKIP_FIELD_TYPES.includes(fm.type)) {
          skippedFields.push(fm.name);
          continue;
        }
        try {
          const cfg = buildFieldConfig(fm);
          initialFields.push(cfg);
        } catch (e) {
          console.warn(`Could not prepare field ${fm.name}:`, e);
          skippedFields.push(fm.name);
        }
      }

      // 创建新表
      const { tableId } = await bitable.base.addTable({
        name: newTableName.trim(),
        fields: initialFields,
      } as any);
      const newTable = await bitable.base.getTableById(tableId);
      const newFieldMetaList = await newTable.getFieldMetaList();
      const fieldNameToIdMap: Record<string, string> = {};
      newFieldMetaList.forEach((field) => {
        fieldNameToIdMap[field.name] = field.id;
      });

      // 缓存新表的单选/多选类型化字段
      const newSingleSelectFields: Map<string, ISingleSelectField> = new Map();
      const newMultiSelectFields: Map<string, IMultiSelectField> = new Map();
      for (const meta of newFieldMetaList) {
        if (meta.type === FieldType.SingleSelect) {
          const field = await newTable.getField<ISingleSelectField>(meta.id);
          newSingleSelectFields.set(meta.name, field);
        } else if (meta.type === FieldType.MultiSelect) {
          const field = await newTable.getField<IMultiSelectField>(meta.id);
          newMultiSelectFields.set(meta.name, field);
        }
      }

      // 找出cost_breakdown字段
      const costBreakdownFieldMeta = tableFieldMetaList.find(
        (f) => f.name.toLowerCase() === "cost_breakdown",
      );

      // 准备记录数据和单选/多选值缓存
      const recordsToAdd: any[] = [];
      const sourceRecordIds = selectedRecords.map((r) => r.id);
      const sourceSelectValues: Array<{
        single: Record<string, string>;
        multi: Record<string, string[]>;
      }> = [];

      for (const recordId of sourceRecordIds) {
        const recordData: Record<string, any> = {};
        const singleValues: Record<string, string> = {};
        const multiValues: Record<string, string[]> = {};

        for (const fieldMeta of tableFieldMetaList) {
          try {
            const field = fieldCache.get(fieldMeta.id);
            if (!field) continue;
            let value = await field.getValue(recordId);

            // 特殊处理 cost_breakdown 字段：调用 Coze API 创建表格副本
            if (
              costBreakdownFieldMeta &&
              fieldMeta.id === costBreakdownFieldMeta.id &&
              value !== null &&
              value !== undefined
            ) {
              const tableUrl =
                typeof value === "string" ? value : String(value);
              console.log(`[Coze] Duplicating table from URL: ${tableUrl.substring(0, 50)}...`);
              const duplicatedTableUrl = await duplicateTableWithCoze(tableUrl);
              
              const newFieldId =
                fieldNameToIdMap[costBreakdownFieldMeta.name];
              if (newFieldId) {
                // Use duplicated URL if successful, otherwise use original URL
                const finalUrl = duplicatedTableUrl || tableUrl;
                recordData[newFieldId] = finalUrl;
                console.log(`[Coze] Record will use: ${duplicatedTableUrl ? "duplicated" : "original"} URL`);
              }
              continue;
            }

            // 收集单选值
            if (fieldMeta.type === FieldType.SingleSelect) {
              if (value !== null && value !== undefined) {
                const text =
                  typeof value === "object"
                    ? (value.text ?? String(value))
                    : String(value);
                singleValues[fieldMeta.name] = text;
              }
            } else if (fieldMeta.type === FieldType.MultiSelect) {
              if (Array.isArray(value)) {
                const texts = value.map((opt: any) =>
                  typeof opt === "object"
                    ? (opt.text ?? String(opt))
                    : String(opt),
                );
                multiValues[fieldMeta.name] = texts;
              }
            }

            // selected 强制 false
            if (
              fieldMeta.id === selectedFieldId &&
              fieldMeta.type === FieldType.Checkbox
            ) {
              value = false;
            }

            // 只写入非单选/多选字段
            if (
              fieldMeta.type !== FieldType.SingleSelect &&
              fieldMeta.type !== FieldType.MultiSelect &&
              value !== null &&
              value !== undefined
            ) {
              const newFieldId = fieldNameToIdMap[fieldMeta.name];
              if (newFieldId) {
                recordData[newFieldId] = value;
              }
            }
          } catch (e) {
            console.warn(`Error reading field ${fieldMeta.name}`, e);
          }
        }

        sourceSelectValues.push({ single: singleValues, multi: multiValues });
        recordsToAdd.push({ fields: recordData });
      }

      // 批量添加记录
      const addResult = (await newTable.addRecords(recordsToAdd)) as any;
      const newRecordIds: string[] = Array.isArray(addResult)
        ? addResult
        : (addResult?.recordIds ?? []);

      // 使用 setValue 写入单选/多选值
      for (
        let i = 0;
        i < newRecordIds.length && i < sourceSelectValues.length;
        i++
      ) {
        const newRecordId = newRecordIds[i];
        const { single, multi } = sourceSelectValues[i];

        // 写入单选
        for (const [fieldName, text] of Object.entries(single)) {
          const field = newSingleSelectFields.get(fieldName);
          if (field && text) {
            try {
              await field.setValue(newRecordId, text);
            } catch (e) {
              console.warn(`Failed to set single select ${fieldName}`, e);
            }
          }
        }

        // 写入多选
        for (const [fieldName, texts] of Object.entries(multi)) {
          const field = newMultiSelectFields.get(fieldName);
          if (field && texts.length > 0) {
            try {
              await field.setValue(newRecordId, texts);
            } catch (e) {
              console.warn(`Failed to set multi select ${fieldName}`, e);
            }
          }
        }
      }

      let successMsg = t("successMessage", {
        count: recordsToAdd.length,
        tableName: newTableName,
      });
      if (skippedFields.length > 0) {
        successMsg +=
          " " + t("skippedFieldsWarning", { fields: skippedFields.join(", ") });
      }

      setStatusMessage(successMsg);
      setStatusType("success");
      message.success(t("operationSuccess"));
      setSelectedRecords([]);
    } catch (error) {
      console.error("Error copying records:", error);
      setStatusMessage(t("errorMessage", { error: (error as Error).message }));
      setStatusType("error");
      message.error(t("operationFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, maxHeight: "100vh", overflow: "auto" }}>
      <Card>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Title level={4}>{t("title")}</Title>
          <Alert message={statusMessage} type={statusType} showIcon />
          <div>
            <Text strong>{t("currentTable")}: </Text>
            <Text>{tableName}</Text>
          </div>

          {selectedFieldId && (
            <Button
              type="dashed"
              onClick={refreshSelectedByCheckbox}
              loading={loading}
              block
              style={{ marginBottom: 12 }}
            >
              刷新选中记录（根据 "selected" 复选框）
            </Button>
          )}

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text strong>
                {t("selectedRecords")}: {selectedRecords.length} {t("records")}
              </Text>
              {selectedRecords.length > 0 && (
                <Button
                  type="link"
                  size="small"
                  onClick={clearSelection}
                  danger
                >
                  {t("clearSelection")}
                </Button>
              )}
            </div>
            {selectedRecords.length > 0 ? (
              <div
                style={{
                  maxHeight: 150,
                  overflow: "auto",
                  border: "1px solid #d9d9d9",
                  borderRadius: 6,
                  padding: 8,
                }}
              >
                {selectedRecords.map((record, index) => (
                  <Tag
                    key={record.id}
                    closable
                    onClose={() => removeRecord(record.id)}
                    style={{ marginBottom: 4 }}
                  >
                    {t("record")} {index + 1}
                  </Tag>
                ))}
              </div>
            ) : (
              <Text type="secondary">
                {selectedFieldId
                  ? "请在表格中勾选 'selected' 复选框后点击上方刷新按钮"
                  : t("clickToSelect")}
              </Text>
            )}
          </div>
          <div>
            <Text strong>{t("newTableName")}: </Text>
            <Input
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              placeholder={t("enterNewTableName")}
              style={{ width: "100%", marginTop: 4 }}
            />
          </div>
          <Button
            type="primary"
            onClick={copyToNewTable}
            loading={loading}
            disabled={selectedRecords.length === 0}
            block
          >
            {loading ? t("copying") : t("copyToNewTable")}
          </Button>
        </Space>
      </Card>
      {loading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(255,255,255,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <Spin size="large" />
        </div>
      )}
    </div>
  );
}
