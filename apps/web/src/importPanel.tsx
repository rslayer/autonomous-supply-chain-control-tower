import { Download, FileUp } from "lucide-react";
import { csvTemplates, validateCsvUpload, type CsvUploadValidationResult, type UploadTableName } from "@control-tower/importers";

const uploadTables = Object.keys(csvTemplates) as UploadTableName[];

interface ImportPanelProps {
  results: CsvUploadValidationResult[];
  onResults: (results: CsvUploadValidationResult[]) => void;
}

export function ImportPanel({ results, onResults }: ImportPanelProps) {
  async function inspectFiles(files: FileList): Promise<void> {
    const validations = await Promise.all(
      Array.from(files).map(async (file) => validateCsvUpload(file.name, await file.text()))
    );
    onResults(validations);
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
        <span>Upload CSV files for validation</span>
        <input
          accept=".csv,text/csv"
          multiple
          type="file"
          onChange={(event) => {
            const files = event.currentTarget.files;
            if (files?.length) void inspectFiles(files);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <div className="upload-results">
        {results.length === 0 && <p className="upload-result">Download templates or validate CSV files before importing operational data.</p>}
        {results.map((result) => (
          <article className={`upload-card ${result.status}`} key={`${result.fileName}-${result.tableName ?? "unknown"}`}>
            <div>
              <strong>{result.fileName}</strong>
              <span>{result.tableName ?? "Unknown table"}</span>
            </div>
            <p>
              {result.validRowCount}/{result.rowCount} rows valid
            </p>
            {result.errors.length > 0 && (
              <ul>
                {result.errors.map((error) => (
                  <li key={`${result.fileName}-${error.row}-${error.message}`}>Row {error.row}: {error.message}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
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
