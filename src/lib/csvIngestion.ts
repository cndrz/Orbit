/**
 * lib/csvIngestion.ts
 *
 * Parses a CSV file (via PapaParse) and batch-inserts the rows into SQLite.
 *
 * Expected CSV columns (case-insensitive headers):
 *   branch_name | location_region | delivery_timestamp | cargo_details | status
 *
 * Usage:
 *   const file = e.target.files[0];
 *   const result = await ingestCsvFile(file);
 *   console.log(`Ingested ${result.inserted} rows`);
 */

import Papa from "papaparse";
import { ingestScheduleCsv } from "./database";
import type { ScheduleCsvRow, DeliveryStatus } from "../types";

const VALID_STATUSES: DeliveryStatus[] = [
  "pending",
  "in_transit",
  "delivered",
  "cancelled",
];

function normaliseStatus(raw: string): DeliveryStatus {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_") as DeliveryStatus;
  return VALID_STATUSES.includes(cleaned) ? cleaned : "pending";
}

export interface CsvIngestResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

/**
 * Accepts a File object from an <input type="file"> element,
 * parses it and inserts valid rows into SQLite.
 */
export function ingestCsvFile(file: File): Promise<CsvIngestResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      transform: (value) => value.trim(),

      complete: async (results) => {
        const valid: ScheduleCsvRow[] = [];
        const errors: string[] = [];
        let skipped = 0;

        for (let i = 0; i < results.data.length; i++) {
          const row = results.data[i];
          const rowNum = i + 2; // +2 because row 1 is header

          // Required field validation
          if (!row.branch_name) {
            errors.push(`Row ${rowNum}: missing branch_name`);
            skipped++;
            continue;
          }
          if (!row.delivery_timestamp) {
            errors.push(`Row ${rowNum}: missing delivery_timestamp`);
            skipped++;
            continue;
          }
          if (!row.cargo_details) {
            errors.push(`Row ${rowNum}: missing cargo_details`);
            skipped++;
            continue;
          }

          // Validate timestamp is parseable
          const ts = new Date(row.delivery_timestamp);
          if (isNaN(ts.getTime())) {
            errors.push(
              `Row ${rowNum}: invalid delivery_timestamp "${row.delivery_timestamp}"`,
            );
            skipped++;
            continue;
          }

          valid.push({
            branch_name: row.branch_name,
            location_region: row.location_region ?? "Unknown",
            delivery_timestamp: ts.toISOString(),
            cargo_details: row.cargo_details,
            status: normaliseStatus(row.status ?? ""),
          });
        }

        if (valid.length === 0) {
          resolve({ inserted: 0, skipped, errors });
          return;
        }

        try {
          await ingestScheduleCsv(valid);
          resolve({ inserted: valid.length, skipped, errors });
        } catch (err) {
          reject(err);
        }
      },

      error: (error) => {
        reject(new Error(`CSV parse error: ${error.message}`));
      },
    });
  });
}

/**
 * Convenience helper: takes a raw CSV string (e.g. from clipboard or fetch)
 * and ingests it. Useful for testing without a file picker.
 */
export async function ingestCsvString(
  csvText: string,
): Promise<CsvIngestResult> {
  const blob = new Blob([csvText], { type: "text/csv" });
  const file = new File([blob], "import.csv", { type: "text/csv" });
  return ingestCsvFile(file);
}

/**
 * Generates a template CSV string for users to download and fill in.
 */
export function getCsvTemplate(): string {
  return [
    "branch_name,location_region,delivery_timestamp,cargo_details,status",
    "Manila Central,NCR,2025-08-01T09:00:00,Electronics – 50 units,pending",
    "Cebu South,Visayas,2025-08-02T14:00:00,Frozen goods – 3 pallets,pending",
  ].join("\n");
}
