// Coze Token 注入（请确保 Token 有效）
(window as any).__COZE_API_TOKEN = "sat_IInQlOyLHwxM0IsOEbi3WETZ1pe77AIdTQ9aOtc6Lb9bJPrmCBzmL7ybSfdk0gmd";

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
  </React.StrictMode>
);

function LoadApp() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [tableName, setTableName] = useState("");
  const [selectedRecords, setSelectedRecords] = useState<SelectedRecord[]>([]);
  const [newTableName, setNewTableName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");

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
          (f) => f.name.toLowerCase() === "selected" && f.type === FieldType.Checkbox
        );
        if (selectedMeta) {
          setSelectedFieldId(selectedMeta.id);
        } else {
          setStatusMessage(t("ready") + "（未检测到 'selected' 复选框字段）");
        }
      } catch (error: any) {
        console.error("Init error:", error);
        setStatusMessage(t("initError"));
        setStatusType("error");
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
          console.warn("getVisibleRecordIdList failed", e);
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
          : t("clickToSelect")
      );
      setStatusType("info");
      message.success(`已刷新，共选中 ${newSelected.length} 条记录`);
    } catch (error) {
      console.error("刷新失败:", error);
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

  // 同步等待 Coze 返回新副本 URL（已修复解析 result.data 字符串）
  const getDuplicatedTableUrlFromCoze = async (originalUrl: string): Promise<string> => {
    const token = (window as any).__COZE_API_TOKEN;
    if (!token) throw new Error("Coze Token 未配置");

    const inputFolderUrl = "https://ycnlvj3d3e9f.feishu.cn/drive/folder/EZu5fIkOBlPg89dPa65c9QvXnue?from=space_personal_filelist&fromShareWithMeNew=1";

    const response = await fetch("https://api.coze.cn/v1/workflow/run", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: "7585399127100981254",
        parameters: {
          input_folder_url: inputFolderUrl,
          input_table_url: originalUrl.trim(),
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Coze 调用失败: ${response.status} ${errText}`);
    }

    const result = await response.json();

    // 修复：URL 在 result.data 字段，是 JSON 字符串
    const dataStr = result.data;
    if (typeof dataStr !== "string") {
      throw new Error("Coze 返回的 data 不是字符串");
    }

    let parsed;
    try {
      parsed = JSON.parse(dataStr);
    } catch (e) {
      throw new Error("解析 Coze data 字符串失败: " + dataStr);
    }

    const newUrl = parsed.output || "";
    if (!newUrl || !newUrl.includes("feishu.cn")) {
      throw new Error("Coze 返回无效 URL: " + newUrl);
    }

    return newUrl;
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
    setStatusMessage("正在复制主表...");
    setStatusType("info");

    try {
      let selection: { tableId?: string | null; viewId?: string | null } = {};
      try {
        selection = (await bitable.base.getSelection()) || {};
      } catch (e) {
        console.warn("getSelection failed:", e);
      }
      const sourceTable =
        selection.tableId
          ? await bitable.base.getTableById(selection.tableId)
          : await bitable.base.getActiveTable();

      const tableFieldMetaList: IFieldMeta[] = await sourceTable.getFieldMetaList();
      const fieldCache: Map<string, any> = new Map();
      for (const fieldMeta of tableFieldMetaList) {
        const field = await sourceTable.getFieldById(fieldMeta.id);
        fieldCache.set(fieldMeta.id, field);
      }

      // 完整的视图字段顺序调整
      let orderedFieldMetaList: IFieldMeta[] = tableFieldMetaList.slice();
      if (selection.viewId) {
        try {
          const view = await sourceTable.getViewById(selection.viewId);
          if (view && typeof view.getFieldMetaList === "function") {
            const viewFieldMetaList: IFieldMeta[] = await view.getFieldMetaList();
            if (viewFieldMetaList && viewFieldMetaList.length > 0) {
              const nameToTableMeta = new Map<string, IFieldMeta>();
              tableFieldMetaList.forEach((fm) => nameToTableMeta.set(fm.name, fm));
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
                      (x) => x.id === (vfm as any).id
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
          console.warn("视图字段排序失败，使用默认顺序", e);
        }
      }

      // 准备新表字段
      const skippedFields: string[] = [];
      const initialFields: any[] = [];
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
        ? tableFieldMetaList.find((f) => f.id === sourcePrimaryFieldId)
        : null;

      if (primaryFieldMeta) {
        if (SKIP_FIELD_TYPES.includes(primaryFieldMeta.type)) {
          skippedFields.push(primaryFieldMeta.name);
        } else {
          const primaryCfg = buildFieldConfig(primaryFieldMeta);
          primaryCfg.is_primary = true;
          primaryCfg.isPrimary = true;
          initialFields.push(primaryCfg);
        }
      }

      for (const fm of orderedFieldMetaList) {
        if (fm.id === sourcePrimaryFieldId) continue;
        if (SKIP_FIELD_TYPES.includes(fm.type)) {
          skippedFields.push(fm.name);
          continue;
        }
        initialFields.push(buildFieldConfig(fm));
      }

      // 创建新表
      const { tableId } = await bitable.base.addTable({
        name: newTableName.trim(),
        fields: initialFields,
      });
      const newTable = await bitable.base.getTableById(tableId);
      const newFieldMetaList = await newTable.getFieldMetaList();
      const fieldNameToIdMap: Record<string, string> = {};
      newFieldMetaList.forEach((field) => {
        fieldNameToIdMap[field.name] = field.id;
      });

      // 单选/多选字段缓存
      const newSingleSelectFields = new Map<string, ISingleSelectField>();
      const newMultiSelectFields = new Map<string, IMultiSelectField >();
      for (const meta of newFieldMetaList) {
        if (meta.type === FieldType.SingleSelect) {
          const field = await newTable.getField<ISingleSelectField>(meta.id);
          newSingleSelectFields.set(meta.name, field);
        } else if (meta.type === FieldType.MultiSelect) {
          const field = await newTable.getField<IMultiSelectField >(meta.id);
          newMultiSelectFields.set(meta.name, field);
        }
      }

      // 找出 cost_breakdown 字段
      const costBreakdownMeta = tableFieldMetaList.find((f) => f.name === "cost_breakdown");

      // 准备记录数据
      const recordsToAdd: any[] = [];
      const sourceRecordIds = selectedRecords.map((r) => r.id);
      const sourceSelectValues: Array<{
        single: Record<string, string>;
        multi: Record<string, string[]>;
      }> = [];

      for (let idx = 0; idx < sourceRecordIds.length; idx++) {
        const recordId = sourceRecordIds[idx];
        const recordData: Record<string, any> = {};
        const singleValues: Record<string, string> = {};
        const multiValues: Record<string, string[]> = {};

        setStatusMessage(`正在处理第 ${idx + 1}/${sourceRecordIds.length} 条记录...`);

        for (const fieldMeta of tableFieldMetaList) {
          try {
            const field = fieldCache.get(fieldMeta.id);
            if (!field) continue;
            let value = await field.getValue(recordId);

            // 特殊处理 cost_breakdown
            if (costBreakdownMeta && fieldMeta.id === costBreakdownMeta.id && value) {
              let originalUrl = "";
              if (typeof value === "string") {
                originalUrl = value;
              } else if (Array.isArray(value) && value.length > 0) {
                const first = value[0];
                originalUrl = first.link || first.url || first.href || "";
              } else if (typeof value === "object" && value !== null) {
                originalUrl = (value as any).link || (value as any).url || (value as any).href || "";
              }

              let finalUrl = originalUrl;

              if (originalUrl && originalUrl.includes("feishu")) {
                try {
                  setStatusMessage(`等待第 ${idx + 1} 条子表副本创建（约30-60秒）...`);
                  finalUrl = await getDuplicatedTableUrlFromCoze(originalUrl);
                  message.success(`第 ${idx + 1} 条子表复制成功！`);
                } catch (e: any) {
                  console.warn("Coze 子表复制失败，使用原链接", e);
                  message.warning(`第 ${idx + 1} 条子表复制失败，使用原链接`);
                }
              }

              const newFieldId = fieldNameToIdMap["cost_breakdown"];
              if (newFieldId) {
                recordData[newFieldId] = finalUrl;
              }
              continue;
            }

            // 单选/多选收集
            if (fieldMeta.type === FieldType.SingleSelect) {
              if (value !== null && value !== undefined) {
                const text = typeof value === "object" ? (value as any).text ?? String(value) : String(value);
                singleValues[fieldMeta.name] = text;
              }
            } else if (fieldMeta.type === FieldType.MultiSelect) {
              if (Array.isArray(value)) {
                const texts = value.map((opt: any) => (typeof opt === "object" ? opt.text ?? String(opt) : String(opt)));
                multiValues[fieldMeta.name] = texts;
              }
            }

            // selected 强制 false
            if (fieldMeta.id === selectedFieldId && fieldMeta.type === FieldType.Checkbox) {
              value = false;
            }

            // 普通字段写入
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
            console.warn(`读取字段 ${fieldMeta.name} 失败`, e);
          }
        }

        sourceSelectValues.push({ single: singleValues, multi: multiValues });
        recordsToAdd.push({ fields: recordData });
      }

      // 批量添加记录
      const addResult = await newTable.addRecords(recordsToAdd);
      const newRecordIds: string[] = Array.isArray(addResult)
        ? addResult
        : addResult?.recordIds ?? [];

      // 写入单选/多选
      for (let i = 0; i < newRecordIds.length && i < sourceSelectValues.length; i++) {
        const newRecordId = newRecordIds[i];
        const { single, multi } = sourceSelectValues[i];

        for (const [fieldName, text] of Object.entries(single)) {
          const field = newSingleSelectFields.get(fieldName);
          if (field && text) {
            try {
              await field.setValue(newRecordId, text);
            } catch (e) {
              console.warn(`设置单选 ${fieldName} 失败`, e);
            }
          }
        }

        for (const [fieldName, texts] of Object.entries(multi)) {
          const field = newMultiSelectFields.get(fieldName);
          if (field && texts.length > 0) {
            try {
              await field.setValue(newRecordId, texts);
            } catch (e) {
              console.warn(`设置多选 ${fieldName} 失败`, e);
            }
          }
        }
      }

      let successMsg = t("successMessage", {
        count: recordsToAdd.length,
        tableName: newTableName,
      });
      if (skippedFields.length > 0) {
        successMsg += `（跳过字段：${skippedFields.join(", ")}）`;
      }
      setStatusMessage(successMsg + " | 所有 cost_breakdown 已使用新副本链接");
      setStatusType("success");
      message.success("复制完成！所有子表均为独立副本");
      setSelectedRecords([]);
    } catch (error: any) {
      console.error("复制过程出错:", error);
      setStatusMessage("错误：" + (error.message || String(error)));
      setStatusType("error");
      message.error("操作失败，请检查控制台");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, maxHeight: "100vh", overflow: "auto" }}>
      <Card>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">

          {/* ✅ 新增：顶部 Logo */}
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <img
              src="https://oss-casualinks.s3.cn-north-1.jdcloud-oss.com/src_images/gemdale_sh_logo.png"
              alt="logo"
              style={{
                maxWidth: 180,
                height: "auto",
              }}
            />
          </div>

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
          <Spin size="large" tip="正在等待子表副本创建，请耐心等待 30-90 秒..." />
        </div>
      )}
    </div>
  );

}