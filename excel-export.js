// excel-export.js — Génération du fichier Excel formaté
// Requires: exceljs

const MOIS_NOMS = ['Janvier','Février','Mars','Avril','Mai','Juin',
                   'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

// Palette couleurs
const COLOR = {
  blue:       'FF1E40AF',
  blueMid:    'FF3B82F6',
  blueLight:  'FFDBEAFE',
  blueXLight: 'FFEFF6FF',
  grey:       'FFF1F5F9',
  white:      'FFFFFFFF',
  text:       'FF1E293B',
  textMuted:  'FF64748B',
  green:      'FF10B981',
  greenLight: 'FFD1FAE5',
};

function border(color = 'FFE2E8F0') {
  const s = { style: 'thin', color: { argb: color } };
  return { top: s, left: s, bottom: s, right: s };
}

function fill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

async function exportToExcel({ db, annee, filePath, services, indicateursGroupes }) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'HRM Stats';
  wb.created  = new Date();
  wb.title    = `Statistiques HRM ${annee}`;

  // ── Fetch all data ────────────────────────────────────────────────────────
  const allRows = db.prepare(
    'SELECT mois, service, indicateur, valeur FROM monthly_stats WHERE annee = ? ORDER BY mois'
  ).all(annee);

  // { mois: { service: { ind: val } } }
  const byMois = {};
  for (const r of allRows) {
    if (!byMois[r.mois]) byMois[r.mois] = {};
    if (!byMois[r.mois][r.service]) byMois[r.mois][r.service] = {};
    byMois[r.mois][r.service][r.indicateur] = r.valeur;
  }

  const moisPresents = Object.keys(byMois).map(Number).sort((a, b) => a - b);
  const nbCols = services.length + 2; // label col + services + total

  // ── Per-month sheets ──────────────────────────────────────────────────────
  for (const moisId of moisPresents) {
    const label = MOIS_NOMS[moisId - 1];
    const sheet = wb.addWorksheet(label, { properties: { tabColor: { argb: COLOR.blueMid } } });
    _writeTableSheet(sheet, label, byMois[moisId] || {}, services, indicateursGroupes, nbCols, annee);
  }

  // ── Consolidated sheet ────────────────────────────────────────────────────
  _writeConsolidatedSheet(wb, annee, byMois, moisPresents, services, indicateursGroupes);

  await wb.xlsx.writeFile(filePath);
}

// ── Write a monthly sheet ──────────────────────────────────────────────────
function _writeTableSheet(sheet, monthLabel, moisData, services, groupes, nbCols, annee) {
  let row = 1;

  // Title
  sheet.mergeCells(row, 1, row, nbCols);
  _cell(sheet, row, 1, {
    value: `Hôpital Régional de Mamou  —  ${monthLabel} ${annee}`,
    font: { bold: true, size: 13, color: { argb: COLOR.white } },
    fill: fill(COLOR.blue),
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  sheet.getRow(row).height = 28;
  row++;

  // Column headers
  const hdrRow = sheet.getRow(row);
  hdrRow.height = 30;
  _cell(sheet, row, 1, {
    value: 'Indicateurs',
    font: { bold: true, size: 10, color: { argb: COLOR.white } },
    fill: fill(COLOR.blue),
    alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
  });
  services.forEach((s, i) => {
    _cell(sheet, row, i + 2, {
      value: s.label,
      font: { bold: true, size: 9, color: { argb: COLOR.white } },
      fill: fill(COLOR.blue),
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    });
  });
  _cell(sheet, row, nbCols, {
    value: 'TOTAL',
    font: { bold: true, size: 10, color: { argb: COLOR.white } },
    fill: fill('FF1E3A8A'),
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  row++;

  // Set column widths
  sheet.getColumn(1).width = 30;
  services.forEach((_, i) => { sheet.getColumn(i + 2).width = 11; });
  sheet.getColumn(nbCols).width = 11;

  // Data rows by group
  for (const groupe of groupes) {
    // Group header
    sheet.mergeCells(row, 1, row, nbCols);
    _cell(sheet, row, 1, {
      value: `  ${groupe.icon}  ${groupe.label}`,
      font: { bold: true, size: 10, color: { argb: COLOR.blue } },
      fill: fill(COLOR.blueLight),
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: border('FFB0C4DE'),
    });
    sheet.getRow(row).height = 18;
    row++;

    for (const item of groupe.items) {
      const isCalc  = !item.editable;
      const isGlobal = groupe.global;
      const isTotal  = item.bold;

      // Row label
      _cell(sheet, row, 1, {
        value: item.label,
        font: { bold: isTotal, italic: isCalc, size: 10, color: { argb: isCalc ? COLOR.textMuted : COLOR.text } },
        fill: isTotal ? fill(COLOR.blueXLight) : fill(COLOR.white),
        alignment: { horizontal: 'left', vertical: 'middle', indent: 2 },
        border: border(),
      });

      let rowTotal = 0;

      if (isGlobal) {
        // Global indicators: one value in merged cells
        const gData = moisData['__GLOBAL__'] || {};
        let val = isCalc && item.calc ? item.calc(gData) : (gData[item.id] || null);
        rowTotal = parseFloat(val) || 0;
        sheet.mergeCells(row, 2, row, nbCols - 1);
        _cell(sheet, row, 2, {
          value: val || null,
          font: { bold: isTotal, italic: isCalc, size: 10 },
          fill: isTotal ? fill(COLOR.blueXLight) : fill(COLOR.grey),
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: border(),
          numFmt: item.type === 'percent' ? '0.0"%"' : item.type === 'decimal' ? '0.00' : undefined,
        });
        _cell(sheet, row, nbCols, {
          value: rowTotal || null,
          font: { bold: true, size: 10 },
          fill: fill(COLOR.blueXLight),
          alignment: { horizontal: 'center' },
          border: border(),
        });
      } else {
        // Service-based
        services.forEach((srv, si) => {
          const sData = moisData[srv.id] || {};
          let val = isCalc && item.calc ? item.calc(sData) : (sData[item.id] || null);
          rowTotal += parseFloat(val) || 0;
          _cell(sheet, row, si + 2, {
            value: val || null,
            font: { bold: isTotal, italic: isCalc, size: 10 },
            fill: isTotal ? fill(COLOR.blueXLight) : fill(COLOR.white),
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: border(),
            numFmt: item.type === 'percent' ? '0.0"%"' : item.type === 'decimal' ? '0.00' : undefined,
          });
        });
        _cell(sheet, row, nbCols, {
          value: rowTotal || null,
          font: { bold: true, size: 10, color: { argb: COLOR.blue } },
          fill: fill(COLOR.blueXLight),
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: border('FF93C5FD'),
        });
      }

      sheet.getRow(row).height = 17;
      row++;
    }
  }

  // Footer
  row++;
  sheet.mergeCells(row, 1, row, nbCols);
  _cell(sheet, row, 1, {
    value: `Généré par HRM Stats · ${new Date().toLocaleDateString('fr-FR')}`,
    font: { italic: true, size: 9, color: { argb: COLOR.textMuted } },
    alignment: { horizontal: 'right' },
  });
}

// ── Consolidated sheet (annual summary) ────────────────────────────────────
function _writeConsolidatedSheet(wb, annee, byMois, moisPresents, services, groupes) {
  const sheet = wb.addWorksheet(`Rapport ${annee}`, {
    properties: { tabColor: { argb: 'FF10B981' } }
  });

  // For consolidated: rows = indicators, cols = months + total
  const nbMois  = moisPresents.length;
  const nbCols  = nbMois + 2; // label + months + total
  let row = 1;

  // Title
  sheet.mergeCells(row, 1, row, nbCols);
  _cell(sheet, row, 1, {
    value: `Hôpital Régional de Mamou  —  Rapport Annuel ${annee}`,
    font: { bold: true, size: 13, color: { argb: COLOR.white } },
    fill: fill('FF065F46'),
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  sheet.getRow(row).height = 28;
  row++;

  // Sub-title: "Consolidation par service — [Mois1 | Mois2 | ...]"
  sheet.mergeCells(row, 1, row, nbCols);
  _cell(sheet, row, 1, {
    value: `Consolidation — ${moisPresents.length} mois saisis`,
    font: { bold: true, size: 10, color: { argb: COLOR.white } },
    fill: fill('FF059669'),
    alignment: { horizontal: 'center' },
  });
  sheet.getRow(row).height = 20;
  row++;

  // Services loop — one section per service
  for (const srv of services) {
    // Service header
    sheet.mergeCells(row, 1, row, nbCols);
    _cell(sheet, row, 1, {
      value: `  🏥  ${srv.label}`,
      font: { bold: true, size: 11, color: { argb: COLOR.white } },
      fill: fill(srv.color ? srv.color.replace('#','FF') : COLOR.blueMid),
      alignment: { horizontal: 'left', vertical: 'middle' },
    });
    sheet.getRow(row).height = 22;
    row++;

    // Month column headers
    const hRow = sheet.getRow(row);
    hRow.height = 24;
    _cell(sheet, row, 1, {
      value: 'Indicateur',
      font: { bold: true, size: 9, color: { argb: COLOR.white } },
      fill: fill('FF334155'),
      alignment: { horizontal: 'left', indent: 1 },
    });
    moisPresents.forEach((m, i) => {
      _cell(sheet, row, i + 2, {
        value: MOIS_NOMS[m - 1].substring(0, 4),
        font: { bold: true, size: 9, color: { argb: COLOR.white } },
        fill: fill('FF334155'),
        alignment: { horizontal: 'center' },
      });
    });
    _cell(sheet, row, nbCols, {
      value: 'TOTAL',
      font: { bold: true, size: 9, color: { argb: COLOR.white } },
      fill: fill('FF1E293B'),
      alignment: { horizontal: 'center' },
    });
    row++;

    // Indicators for this service
    for (const groupe of groupes) {
      if (groupe.global) continue;
      for (const item of groupe.items) {
        if (!item.editable && !item.bold) continue; // only show editable + totals
        let annualTotal = 0;
        _cell(sheet, row, 1, {
          value: item.label,
          font: { bold: item.bold, size: 9 },
          fill: item.bold ? fill(COLOR.blueXLight) : fill(COLOR.white),
          alignment: { horizontal: 'left', indent: 2 },
          border: border(),
        });
        moisPresents.forEach((m, i) => {
          const sData = (byMois[m] || {})[srv.id] || {};
          let val = item.calc ? item.calc(sData) : (sData[item.id] || null);
          annualTotal += parseFloat(val) || 0;
          _cell(sheet, row, i + 2, {
            value: val || null,
            font: { bold: item.bold, size: 9 },
            fill: item.bold ? fill(COLOR.blueXLight) : fill(COLOR.white),
            alignment: { horizontal: 'center' },
            border: border(),
            numFmt: item.type === 'percent' ? '0.0"%"' : item.type === 'decimal' ? '0.00' : undefined,
          });
        });
        _cell(sheet, row, nbCols, {
          value: annualTotal || null,
          font: { bold: true, size: 9, color: { argb: COLOR.blue } },
          fill: fill(COLOR.blueXLight),
          alignment: { horizontal: 'center' },
          border: border(),
        });
        sheet.getRow(row).height = 16;
        row++;
      }
    }
    row++; // spacer
  }

  // Column widths
  sheet.getColumn(1).width = 28;
  moisPresents.forEach((_, i) => { sheet.getColumn(i + 2).width = 9; });
  sheet.getColumn(nbCols).width = 10;
}

// ── Cell helper ────────────────────────────────────────────────────────────
function _cell(sheet, r, c, { value, font, fill: f, alignment, border: b, numFmt } = {}) {
  const cell = sheet.getCell(r, c);
  if (value !== undefined) cell.value = value;
  if (font)      cell.font      = font;
  if (f)         cell.fill      = f;
  if (alignment) cell.alignment = alignment;
  if (b)         cell.border    = b;
  if (numFmt)    cell.numFmt    = numFmt;
  return cell;
}

module.exports = { exportToExcel };
