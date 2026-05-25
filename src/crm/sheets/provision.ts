import type { BatchUpdateRequest, SheetsClient, SpreadsheetMeta } from "./client.js";
import {
  BAND_FILL,
  BORDER_HAIRLINE,
  HEADER_FILL,
  HEADER_TEXT,
  LEADS_COLUMNS,
  SIGNAL,
  SENTIMENT_FILL,
  SENTIMENT_TEXT,
  SENTIMENT_VALUES,
  STAGE_FILL,
  STAGE_VALUES,
  TAB,
  colIndex,
  hex,
} from "./schema.js";

/**
 * Provision a spreadsheet to look like a premium CRM dashboard.
 *
 * Idempotent: missing tabs are created, existing tabs are left in place. The
 * formatting calls (`repeatCell`, `updateDimensionProperties`, etc.) overwrite
 * cleanly, so re-running the script after a schema bump heals the look.
 *
 * Design language: clean light body for daily use; near-black header band,
 * signal-lime accent on the Won stage and dashboard rail. Anchors to the same
 * "Signal" palette as `web/tailwind.config.ts`.
 */
export async function provisionSpreadsheet(
  client: SheetsClient,
  spreadsheetId: string,
): Promise<void> {
  let meta = await client.getSpreadsheet(spreadsheetId);

  // 1. Ensure every required tab exists. Done first so subsequent requests
  //    can reference sheetIds by title.
  const ensures: BatchUpdateRequest[] = [];
  for (const title of [TAB.DASHBOARD, TAB.LEADS, TAB.BOOKINGS, TAB.REVENUE]) {
    if (!sheetByTitle(meta, title)) {
      ensures.push({
        addSheet: {
          properties: {
            title,
            gridProperties: {
              rowCount: title === TAB.LEADS ? 1000 : 100,
              columnCount: title === TAB.LEADS ? LEADS_COLUMNS.length : 12,
              frozenRowCount: title === TAB.LEADS ? 1 : 0,
            },
          },
        },
      });
    }
  }
  if (ensures.length > 0) {
    await client.batchUpdateSpreadsheet(spreadsheetId, ensures);
    meta = await client.getSpreadsheet(spreadsheetId);
  }

  // 2. Idempotency reset — drop any existing bandings and conditional format
  //    rules on the tabs we own. `addBanding` rejects overlap and
  //    `addConditionalFormatRule` appends, so without this step a re-run
  //    would either error or stack duplicate rules.
  const resets = buildResetRequests(meta);
  if (resets.length > 0) {
    await client.batchUpdateSpreadsheet(spreadsheetId, resets);
    // Re-fetch so subsequent helpers see the clean state.
    meta = await client.getSpreadsheet(spreadsheetId);
  }

  // 3. Per-tab formatting + content. Each helper returns its requests so we
  //    can batch them into one round-trip for atomicity + speed.
  const requests: BatchUpdateRequest[] = [
    ...formatLeadsTab(meta),
    ...formatDashboardTab(meta),
    ...formatBookingsTab(meta),
    ...formatRevenueTab(meta),
    ...reorderTabs(meta),
    ...deleteDefaultSheetIfPresent(meta),
  ];
  if (requests.length > 0) {
    await client.batchUpdateSpreadsheet(spreadsheetId, requests);
  }
}

/**
 * Build delete requests for every banding and conditional format rule on the
 * tabs we own. Conditional rules are deleted by index — and indices shift as
 * earlier rules are removed — so we emit them in descending index order to
 * keep the batch correct.
 */
function buildResetRequests(meta: SpreadsheetMeta): BatchUpdateRequest[] {
  const ourTitles = new Set<string>([TAB.DASHBOARD, TAB.LEADS, TAB.BOOKINGS, TAB.REVENUE]);
  const out: BatchUpdateRequest[] = [];
  for (const sheet of meta.sheets) {
    if (!ourTitles.has(sheet.properties.title)) continue;
    const sheetId = sheet.properties.sheetId;
    for (const band of sheet.bandedRanges ?? []) {
      out.push({ deleteBanding: { bandedRangeId: band.bandedRangeId } });
    }
    const cfCount = (sheet.conditionalFormats ?? []).length;
    for (let i = cfCount - 1; i >= 0; i--) {
      out.push({ deleteConditionalFormatRule: { sheetId, index: i } });
    }
  }
  return out;
}

// ── Leads tab ────────────────────────────────────────────────────────────

function formatLeadsTab(meta: SpreadsheetMeta): BatchUpdateRequest[] {
  const sheetId = requireSheetId(meta, TAB.LEADS);
  const out: BatchUpdateRequest[] = [];

  // Header row content + style.
  out.push({
    updateCells: {
      range: rangeRow(sheetId, 0),
      rows: [
        {
          values: LEADS_COLUMNS.map((c) => ({
            userEnteredValue: { stringValue: c.header },
            userEnteredFormat: {
              backgroundColor: hex(HEADER_FILL),
              textFormat: {
                foregroundColor: hex(HEADER_TEXT),
                bold: true,
                fontSize: 10,
                fontFamily: "Inter",
              },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
              padding: { top: 8, bottom: 8, left: 10, right: 10 },
            },
          })),
        },
      ],
      fields:
        "userEnteredValue,userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)",
    },
  });

  // Row height — slightly more generous than default for that premium feel.
  out.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 38 },
      fields: "pixelSize",
    },
  });

  // Column widths + hide the __state column.
  LEADS_COLUMNS.forEach((c, i) => {
    out.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: c.width, hiddenByUser: c.hidden ?? false },
        fields: "pixelSize,hiddenByUser",
      },
    });
  });

  // Column number formats + body cell styling (font, alignment, hairline borders).
  LEADS_COLUMNS.forEach((c, i) => {
    const fmt: Record<string, unknown> = {
      verticalAlignment: "MIDDLE",
      horizontalAlignment: c.align ?? "LEFT",
      textFormat: {
        fontFamily: c.mono ? "Roboto Mono" : "Inter",
        fontSize: 10,
        foregroundColor: hex("#1A1A1F"),
      },
      padding: { top: 6, bottom: 6, left: 10, right: 10 },
    };
    if (c.numberFormat) {
      fmt.numberFormat = { type: c.numberFormat.type, pattern: c.numberFormat.pattern };
    }
    out.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1, // body rows only
          startColumnIndex: i,
          endColumnIndex: i + 1,
        },
        cell: { userEnteredFormat: fmt },
        fields: "userEnteredFormat",
      },
    });
  });

  // Banded rows — subtle, premium.
  out.push({
    addBanding: {
      bandedRange: {
        range: {
          sheetId,
          startRowIndex: 0,
          startColumnIndex: 0,
          endColumnIndex: LEADS_COLUMNS.length,
        },
        rowProperties: {
          headerColor: hex(HEADER_FILL),
          firstBandColor: hex("#FFFFFF"),
          secondBandColor: hex(BAND_FILL),
        },
      },
    },
  });

  // Stage dropdown + conditional fills.
  const stageCol = colIndex("stage");
  out.push({
    setDataValidation: {
      range: {
        sheetId,
        startRowIndex: 1,
        startColumnIndex: stageCol,
        endColumnIndex: stageCol + 1,
      },
      rule: {
        condition: {
          type: "ONE_OF_LIST",
          values: STAGE_VALUES.map((s) => ({ userEnteredValue: s })),
        },
        showCustomUi: true,
        strict: true,
      },
    },
  });
  for (const stage of STAGE_VALUES) {
    out.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [
            {
              sheetId,
              startRowIndex: 1,
              startColumnIndex: stageCol,
              endColumnIndex: stageCol + 1,
            },
          ],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: stage }] },
            format: {
              backgroundColor: hex(STAGE_FILL[stage]),
              textFormat: {
                bold: stage === "Won",
                foregroundColor: hex(stage === "Won" ? "#101013" : "#1A1A1F"),
              },
            },
          },
        },
        index: 0,
      },
    });
  }

  // Sentiment dropdown + conditional fills/text colors.
  const sentCol = colIndex("sentiment");
  out.push({
    setDataValidation: {
      range: {
        sheetId,
        startRowIndex: 1,
        startColumnIndex: sentCol,
        endColumnIndex: sentCol + 1,
      },
      rule: {
        condition: {
          type: "ONE_OF_LIST",
          values: SENTIMENT_VALUES.map((s) => ({ userEnteredValue: s })),
        },
        showCustomUi: true,
        strict: true,
      },
    },
  });
  for (const sent of SENTIMENT_VALUES) {
    out.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [
            {
              sheetId,
              startRowIndex: 1,
              startColumnIndex: sentCol,
              endColumnIndex: sentCol + 1,
            },
          ],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: sent }] },
            format: {
              backgroundColor: hex(SENTIMENT_FILL[sent]),
              textFormat: {
                bold: true,
                foregroundColor: hex(SENTIMENT_TEXT[sent]),
              },
            },
          },
        },
        index: 0,
      },
    });
  }

  // Hairline column borders for that "designed" feel.
  out.push({
    updateBorders: {
      range: {
        sheetId,
        startRowIndex: 0,
        startColumnIndex: 0,
        endRowIndex: 1000,
        endColumnIndex: LEADS_COLUMNS.length,
      },
      innerVertical: { style: "SOLID", color: hex(BORDER_HAIRLINE) },
    },
  });

  return out;
}

// ── Dashboard tab ────────────────────────────────────────────────────────

function formatDashboardTab(meta: SpreadsheetMeta): BatchUpdateRequest[] {
  const sheetId = requireSheetId(meta, TAB.DASHBOARD);
  const out: BatchUpdateRequest[] = [];

  // Generous column widths for big-number tiles.
  out.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 9 },
      properties: { pixelSize: 130 },
      fields: "pixelSize",
    },
  });
  // Title row height.
  out.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 64 },
      fields: "pixelSize",
    },
  });
  // KPI tile heights.
  out.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "ROWS", startIndex: 4, endIndex: 5 },
      properties: { pixelSize: 22 },
      fields: "pixelSize",
    },
  });
  out.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "ROWS", startIndex: 5, endIndex: 6 },
      properties: { pixelSize: 56 },
      fields: "pixelSize",
    },
  });

  // Title strip — bold + signal underline.
  out.push({
    updateCells: {
      range: {
        sheetId,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: 9,
      },
      rows: [
        {
          values: [
            {
              userEnteredValue: { stringValue: "DM-to-Deal" },
              userEnteredFormat: {
                backgroundColor: hex(HEADER_FILL),
                textFormat: {
                  foregroundColor: hex(SIGNAL),
                  fontFamily: "Inter",
                  fontSize: 18,
                  bold: true,
                },
                verticalAlignment: "MIDDLE",
                padding: { top: 16, bottom: 16, left: 18, right: 12 },
              },
            },
            ...Array(8).fill({
              userEnteredFormat: {
                backgroundColor: hex(HEADER_FILL),
                verticalAlignment: "MIDDLE",
              },
            }),
          ],
        },
      ],
      fields: "userEnteredValue,userEnteredFormat",
    },
  });

  // Sub-line under the title.
  out.push({
    updateCells: {
      range: {
        sheetId,
        startRowIndex: 1,
        endRowIndex: 2,
        startColumnIndex: 0,
        endColumnIndex: 9,
      },
      rows: [
        {
          values: [
            {
              userEnteredValue: { stringValue: "Pipeline · live · in your voice" },
              userEnteredFormat: {
                backgroundColor: hex("#FFFFFF"),
                textFormat: {
                  foregroundColor: hex("#65656E"),
                  fontFamily: "Inter",
                  fontSize: 11,
                  italic: false,
                },
                padding: { top: 8, bottom: 8, left: 18, right: 12 },
              },
            },
          ],
        },
      ],
      fields: "userEnteredValue,userEnteredFormat",
    },
  });

  // KPI tile labels (row 5, index 4).
  const kpiLabels = ["Leads", "Active", "Booked", "Won", "Revenue", "Win rate"];
  out.push({
    updateCells: {
      range: {
        sheetId,
        startRowIndex: 4,
        endRowIndex: 5,
        startColumnIndex: 0,
        endColumnIndex: 6,
      },
      rows: [
        {
          values: kpiLabels.map((label) => ({
            userEnteredValue: { stringValue: label.toUpperCase() },
            userEnteredFormat: {
              backgroundColor: hex("#FFFFFF"),
              textFormat: {
                foregroundColor: hex("#9A9AA2"),
                fontFamily: "Roboto Mono",
                fontSize: 9,
                bold: true,
              },
              padding: { left: 14, top: 4, bottom: 0, right: 6 },
            },
          })),
        },
      ],
      fields: "userEnteredValue,userEnteredFormat",
    },
  });

  // KPI tile values (row 6, index 5) — formulas reading from the Leads tab.
  const stageCol = colLetterFor("stage");
  const revenueCol = colLetterFor("revenue");
  const handleCol = colLetterFor("igHandle");
  const formulas: Array<{ formula: string; format?: "CURRENCY" | "PERCENT" | "NUMBER" }> = [
    { formula: `=COUNTA(${TAB.LEADS}!${handleCol}2:${handleCol})`, format: "NUMBER" },
    {
      formula: `=COUNTIFS(${TAB.LEADS}!${stageCol}2:${stageCol},"<>Lost",${TAB.LEADS}!${stageCol}2:${stageCol},"<>Won",${TAB.LEADS}!${stageCol}2:${stageCol},"<>")`,
      format: "NUMBER",
    },
    {
      formula: `=COUNTIF(${TAB.LEADS}!${stageCol}2:${stageCol},"Booked")+COUNTIF(${TAB.LEADS}!${stageCol}2:${stageCol},"Won")`,
      format: "NUMBER",
    },
    { formula: `=COUNTIF(${TAB.LEADS}!${stageCol}2:${stageCol},"Won")`, format: "NUMBER" },
    { formula: `=SUM(${TAB.LEADS}!${revenueCol}2:${revenueCol})`, format: "CURRENCY" },
    {
      formula: `=IFERROR(COUNTIF(${TAB.LEADS}!${stageCol}2:${stageCol},"Won")/COUNTA(${TAB.LEADS}!${handleCol}2:${handleCol}),0)`,
      format: "PERCENT",
    },
  ];

  out.push({
    updateCells: {
      range: {
        sheetId,
        startRowIndex: 5,
        endRowIndex: 6,
        startColumnIndex: 0,
        endColumnIndex: 6,
      },
      rows: [
        {
          values: formulas.map(({ formula, format }) => ({
            userEnteredValue: { formulaValue: formula },
            userEnteredFormat: {
              backgroundColor: hex("#FFFFFF"),
              textFormat: {
                foregroundColor: hex("#101013"),
                fontFamily: "Inter",
                fontSize: 24,
                bold: true,
              },
              verticalAlignment: "MIDDLE",
              padding: { left: 14, top: 0, bottom: 8, right: 6 },
              numberFormat:
                format === "CURRENCY"
                  ? { type: "CURRENCY", pattern: '"$"#,##0' }
                  : format === "PERCENT"
                    ? { type: "PERCENT", pattern: "0.0%" }
                    : { type: "NUMBER", pattern: "0" },
            },
          })),
        },
      ],
      fields: "userEnteredValue,userEnteredFormat",
    },
  });

  // Bottom rail strip — thin signal-lime line under the KPIs (row 7).
  out.push({
    updateCells: {
      range: {
        sheetId,
        startRowIndex: 7,
        endRowIndex: 8,
        startColumnIndex: 0,
        endColumnIndex: 6,
      },
      rows: [
        {
          values: Array(6).fill({
            userEnteredFormat: { backgroundColor: hex(SIGNAL) },
          }),
        },
      ],
      fields: "userEnteredFormat.backgroundColor",
    },
  });
  out.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "ROWS", startIndex: 7, endIndex: 8 },
      properties: { pixelSize: 3 },
      fields: "pixelSize",
    },
  });

  // Funnel block (rows 10+).
  const funnelHeader = "FUNNEL";
  out.push({
    updateCells: {
      range: {
        sheetId,
        startRowIndex: 9,
        endRowIndex: 10,
        startColumnIndex: 0,
        endColumnIndex: 6,
      },
      rows: [
        {
          values: [
            {
              userEnteredValue: { stringValue: funnelHeader },
              userEnteredFormat: {
                textFormat: {
                  foregroundColor: hex("#65656E"),
                  fontFamily: "Roboto Mono",
                  fontSize: 9,
                  bold: true,
                },
                padding: { left: 14, top: 12, bottom: 4, right: 6 },
              },
            },
          ],
        },
      ],
      fields: "userEnteredValue,userEnteredFormat",
    },
  });

  STAGE_VALUES.forEach((stage, i) => {
    const row = 10 + i;
    out.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: row,
          endRowIndex: row + 1,
          startColumnIndex: 0,
          endColumnIndex: 4,
        },
        rows: [
          {
            values: [
              {
                userEnteredValue: { stringValue: stage },
                userEnteredFormat: {
                  backgroundColor: hex(STAGE_FILL[stage]),
                  textFormat: {
                    foregroundColor: hex("#101013"),
                    fontFamily: "Inter",
                    fontSize: 11,
                    bold: stage === "Won",
                  },
                  padding: { left: 14, top: 6, bottom: 6, right: 6 },
                },
              },
              {
                userEnteredValue: {
                  formulaValue: `=COUNTIF(${TAB.LEADS}!${stageCol}2:${stageCol},"${stage}")`,
                },
                userEnteredFormat: {
                  textFormat: {
                    foregroundColor: hex("#101013"),
                    fontFamily: "Roboto Mono",
                    fontSize: 12,
                    bold: true,
                  },
                  horizontalAlignment: "RIGHT",
                  padding: { left: 6, top: 6, bottom: 6, right: 14 },
                  numberFormat: { type: "NUMBER", pattern: "0" },
                },
              },
            ],
          },
        ],
        fields: "userEnteredValue,userEnteredFormat",
      },
    });
  });

  // Hide gridlines on the dashboard for that polished app feel.
  out.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { hideGridlines: true } },
      fields: "gridProperties.hideGridlines",
    },
  });

  return out;
}

// ── Bookings + Revenue tabs (derived views) ──────────────────────────────

function formatBookingsTab(meta: SpreadsheetMeta): BatchUpdateRequest[] {
  const sheetId = requireSheetId(meta, TAB.BOOKINGS);
  return derivedFilterTab({
    sheetId,
    headers: ["IG Handle", "Name", "Stage", "Booking Sent", "First Contact"],
    formula: derivedQuery({
      cols: ["igHandle", "name", "stage", "bookingSentAt", "firstContact"],
      where: `(${TAB.LEADS}!${colLetterFor("stage")}2:${colLetterFor("stage")}="Booked" + ${TAB.LEADS}!${colLetterFor(
        "stage",
      )}2:${colLetterFor("stage")}="BookingSent")`,
    }),
  });
}

function formatRevenueTab(meta: SpreadsheetMeta): BatchUpdateRequest[] {
  const sheetId = requireSheetId(meta, TAB.REVENUE);
  return derivedFilterTab({
    sheetId,
    headers: ["IG Handle", "Name", "Booking Sent", "Revenue"],
    formula: derivedQuery({
      cols: ["igHandle", "name", "bookingSentAt", "revenue"],
      where: `${TAB.LEADS}!${colLetterFor("stage")}2:${colLetterFor("stage")}="Won"`,
    }),
  });
}

interface DerivedTab {
  sheetId: number;
  headers: string[];
  formula: string;
}

function derivedFilterTab({ sheetId, headers, formula }: DerivedTab): BatchUpdateRequest[] {
  const out: BatchUpdateRequest[] = [];

  // Header row.
  out.push({
    updateCells: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length },
      rows: [
        {
          values: headers.map((h) => ({
            userEnteredValue: { stringValue: h },
            userEnteredFormat: {
              backgroundColor: hex(HEADER_FILL),
              textFormat: {
                foregroundColor: hex(HEADER_TEXT),
                fontFamily: "Inter",
                fontSize: 10,
                bold: true,
              },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
              padding: { top: 8, bottom: 8 },
            },
          })),
        },
      ],
      fields: "userEnteredValue,userEnteredFormat",
    },
  });
  out.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 36 },
      fields: "pixelSize",
    },
  });
  out.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: headers.length },
      properties: { pixelSize: 170 },
      fields: "pixelSize",
    },
  });

  // The filter formula lives in A2 — Sheets spreads the result across cells.
  out.push({
    updateCells: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 1 },
      rows: [
        {
          values: [
            {
              userEnteredValue: { formulaValue: formula },
              userEnteredFormat: {
                textFormat: { fontFamily: "Inter", fontSize: 10 },
                padding: { left: 10, right: 10, top: 4, bottom: 4 },
              },
            },
          ],
        },
      ],
      fields: "userEnteredValue,userEnteredFormat",
    },
  });

  return out;
}

/** Build a FILTER(...) formula that pulls a subset of Leads columns. */
function derivedQuery(opts: { cols: Parameters<typeof colLetterFor>[0][]; where: string }): string {
  const refs = opts.cols
    .map((k) => `${TAB.LEADS}!${colLetterFor(k)}2:${colLetterFor(k)}`)
    .join(", ");
  return `=IFERROR(FILTER({${refs}}, ${opts.where}), "No matching leads yet")`;
}

// ── Misc plumbing ────────────────────────────────────────────────────────

function reorderTabs(meta: SpreadsheetMeta): BatchUpdateRequest[] {
  const desired = [TAB.DASHBOARD, TAB.LEADS, TAB.BOOKINGS, TAB.REVENUE];
  const out: BatchUpdateRequest[] = [];
  desired.forEach((title, index) => {
    const s = sheetByTitle(meta, title);
    if (!s) return;
    if (s.properties.index !== index) {
      out.push({
        updateSheetProperties: {
          properties: { sheetId: s.properties.sheetId, index },
          fields: "index",
        },
      });
    }
  });
  return out;
}

function deleteDefaultSheetIfPresent(meta: SpreadsheetMeta): BatchUpdateRequest[] {
  // Newly-created spreadsheets ship with a "Sheet1". Remove it if our tabs exist.
  const sheet1 = sheetByTitle(meta, "Sheet1");
  if (!sheet1) return [];
  return [{ deleteSheet: { sheetId: sheet1.properties.sheetId } }];
}

function sheetByTitle(meta: SpreadsheetMeta, title: string) {
  return meta.sheets.find((s) => s.properties.title === title);
}

function requireSheetId(meta: SpreadsheetMeta, title: string): number {
  const s = sheetByTitle(meta, title);
  if (!s) throw new Error(`provision: expected sheet "${title}" to exist`);
  return s.properties.sheetId;
}

function rangeRow(sheetId: number, rowIndex: number) {
  return {
    sheetId,
    startRowIndex: rowIndex,
    endRowIndex: rowIndex + 1,
    startColumnIndex: 0,
    endColumnIndex: LEADS_COLUMNS.length,
  };
}

function colLetterFor(key: Parameters<typeof colIndex>[0]): string {
  // 0-based index → A1 letter.
  let n = colIndex(key);
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}
