const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hrm', {
  saveMonthData:       (args) => ipcRenderer.invoke('save-month-data', args),
  loadMonthData:       (args) => ipcRenderer.invoke('load-month-data', args),
  loadAnnualData:      (args) => ipcRenderer.invoke('load-annual-data', args),
  getAvailableYears:   ()     => ipcRenderer.invoke('get-available-years'),
  getAvailableMonths:  (args) => ipcRenderer.invoke('get-available-months', args),
  queryStats:          (args) => ipcRenderer.invoke('query-stats', args),
  getDashboardSummary: (args) => ipcRenderer.invoke('get-dashboard-summary', args),
  getMonthlyTrend:     (args) => ipcRenderer.invoke('get-monthly-trend', args),
  monthHasData:        (args) => ipcRenderer.invoke('month-has-data', args),
  deleteMonthData:     (args) => ipcRenderer.invoke('delete-month-data', args),
  getDbInfo:           ()     => ipcRenderer.invoke('get-db-info'),
  openDataFolder:      ()     => ipcRenderer.invoke('open-data-folder'),
  exportCsv:           (args) => ipcRenderer.invoke('export-csv', args),
  getSetting:          (key)  => ipcRenderer.invoke('get-setting', key),
  setSetting:          (args) => ipcRenderer.invoke('set-setting', args),
  getNbreLitDefaults:  (args) => ipcRenderer.invoke('get-nbre-lit-defaults', args),
  exportExcel:         (args) => ipcRenderer.invoke('export-excel', args),
  selectLogo:          ()     => ipcRenderer.invoke('select-logo'),
  getLogo:             ()     => ipcRenderer.invoke('get-logo'),
  removeLogo:          ()     => ipcRenderer.invoke('remove-logo'),
  // Auto-update
  onUpdateStatus:      (cb)   => ipcRenderer.on('update-status', (_, d) => cb(d)),
  updateDownload:      ()     => ipcRenderer.invoke('update-download'),
  updateInstall:       ()     => ipcRenderer.invoke('update-install'),
  getAppVersion:       ()     => ipcRenderer.invoke('get-app-version'),
});
