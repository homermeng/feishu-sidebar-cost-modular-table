import React, { useEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { bitable, IFieldMeta, FieldType } from "@lark-base-open/js-sdk";
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

  useEffect(() => {
    const init = async () => {
      try {
        const table = await bitable.base.getActiveTable();
        const name = await table.getName();
        setTableName(name);
        setNewTableName(`${name}_${t("copy")}`);
        setStatusMessage(t("ready"));
        setStatusType("info");
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

    const unsubscribe = bitable.base.onSelectionChange(async (event) => {
      if (event.data.recordId) {
        const recordId = event.data.recordId;

        setSelectedRecords((prev) => {
          if (prev.some((r) => r.id === recordId)) {
            return prev;
          }

          const newRecord: SelectedRecord = {
            id: recordId,
            displayText: `${t("record")} ${prev.length + 1}`,
          };

          return [...prev, newRecord];
        });
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [t]);

  const removeRecord = (recordId: string) => {
    setSelectedRecords((prev) => prev.filter((r) => r.id !== recordId));
  };

  const clearSelection = () => {
    setSelectedRecords([]);
    setStatusMessage(t("selectionCleared"));
    setStatusType("info");
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
      const sourceTable = await bitable.base.getActiveTable();
      const fieldMetaList = await sourceTable.getFieldMetaList();

      const fieldCache: Map<string, any> = new Map();
      for (const fieldMeta of fieldMetaList) {
        const field = await sourceTable.getFieldById(fieldMeta.id);
        fieldCache.set(fieldMeta.id, field);
      }

      const { tableId } = await bitable.base.addTable({
        name: newTableName.trim(),
        fields: [],
      } as any);

      const newTable = await bitable.base.getTableById(tableId);

      const skippedFields: string[] = [];

      // 过滤出可复制的字段，保持原表顺序
      const copiableFields = fieldMetaList.filter(
        (fieldMeta) => !SKIP_FIELD_TYPES.includes(fieldMeta.type)
      );

      // 获取新表自动创建的默认索引字段
      const initialFieldMetaList = await newTable.getFieldMetaList();
      const defaultIndexField = initialFieldMetaList[0];

      let isFirstFieldHandled = false;

      for (let i = 0; i < copiableFields.length; i++) {
        const fieldMeta = copiableFields[i];

        try {
          if (!isFirstFieldHandled && defaultIndexField) {
            // 第一个可复制字段：修改默认索引字段的名称以匹配原表第一个字段
            // 注意：索引字段必须是文本类型，所以我们只修改名称
            const indexField = await newTable.getFieldById(defaultIndexField.id);
            // 使用类型断言调用 setName 方法
            await (indexField as any).setName(fieldMeta.name);
            isFirstFieldHandled = true;
          } else {
            // 后续字段：按顺序添加
            const fieldConfig: any = {
              name: fieldMeta.name,
              type: fieldMeta.type,
            };

            if ((fieldMeta as any).property) {
              const property = { ...(fieldMeta as any).property };
              delete property.fieldId;
              delete property.tableId;
              fieldConfig.property = property;
            }

            await newTable.addField(fieldConfig);
          }
        } catch (e) {
          console.warn(`Could not add field ${fieldMeta.name}:`, e);
          skippedFields.push(fieldMeta.name);
        }
      }

      // 记录被跳过的字段（计算字段等）
      for (const fieldMeta of fieldMetaList) {
        if (SKIP_FIELD_TYPES.includes(fieldMeta.type)) {
          skippedFields.push(fieldMeta.name);
        }
      }

      const newFieldMetaList = await newTable.getFieldMetaList();
      const fieldNameToIdMap: Record<string, string> = {};
      newFieldMetaList.forEach((field) => {
        fieldNameToIdMap[field.name] = field.id;
      });

      const recordsToAdd = [];
      const recordIds = selectedRecords.map((r) => r.id);

      for (const recordId of recordIds) {
        try {
          const recordData: Record<string, any> = {};

          for (const fieldMeta of fieldMetaList) {
            try {
              const field = fieldCache.get(fieldMeta.id);
              if (!field) continue;

              const value = await field.getValue(recordId);

              if (value !== null && value !== undefined) {
                const newFieldId = fieldNameToIdMap[fieldMeta.name];
                if (newFieldId) {
                  recordData[newFieldId] = value;
                }
              }
            } catch (fieldError) {
              console.warn(
                `Error getting field value for ${fieldMeta.name}:`,
                fieldError,
              );
            }
          }

          if (Object.keys(recordData).length > 0) {
            recordsToAdd.push({ fields: recordData });
          }
        } catch (recordError) {
          console.warn(`Error processing record ${recordId}:`, recordError);
        }
      }

      if (recordsToAdd.length > 0) {
        await newTable.addRecords(recordsToAdd);
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
              <Text type="secondary">{t("clickToSelect")}</Text>
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
