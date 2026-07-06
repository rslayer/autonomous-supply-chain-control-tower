import { Download, FileUp } from "lucide-react";
import { csvTemplates, type UploadTableName } from "@control-tower/importers";

const uploadTables = Object.keys(csvTemplates) as UploadTableName[];

interface ImportPanelProps {
  result: string;
  onResult: (message: string) => void;
}

export function ImportPanel({ result, onResult }: ImportPanelProps) {
  async function inspectFile(file: File): Promise<void> {
    const text = await file.text();
    const [header = ""] = text.trim().split(/\r?\n/);
    const normalizedHeader = normalizeCsvHeader(header);
    const match = uploadTables.find((table) => normalizeCsvHeader(csvTemplates[table]) === normalizedHeader);

    if (!match) {
      onResult(`${file.name}: header does not match a known template.`);
      return;
    }

    const rowCount = Math.max(0, text.trim().split(/\r?\n/).length - 1);
    onResult(`${file.name}: recognized ${match} upload with ${rowCount} data rows.`);
  }

  return (
    <div className="import-panel">
      <div className="template-grid">
        {uploadTables.map((table) => (
          <button key={table} onClick={() => downloadTemplate(table)}>
            <Download size={16} />
            {table}
          </button>
        ))}
      </div>
      <label className="upload-target">
        <FileUp size={18} />
        <span>Upload CSV for header check</span>
        <input
          accept=".csv,text/csv"
          type="file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void inspectFile(file);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <p className="upload-result">{result}</p>
    </div>
  );
}

function downloadTemplate(table: UploadTableName): void {
  const csv = `${csvTemplates[table]}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${table}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeCsvHeader(header: string): string {
  return header
    .split(",")
    .map((column) => column.trim().toLowerCase())
    .join(",");
}
