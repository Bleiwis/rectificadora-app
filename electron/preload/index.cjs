const { contextBridge, ipcRenderer } = require("electron");

const AUTH_CHANNELS = {
  setupMasterUser: "auth:setup-master-user",
  signIn: "auth:sign-in",
  checkUsername: "auth:check-username",
  setInitialPassword: "auth:set-initial-password",
  getUserById: "auth:get-user-by-id",
  getBootstrapState: "auth:get-bootstrap-state",
  listUsers: "auth:list-users",
  createUser: "auth:create-user",
  deactivateUser: "auth:deactivate-user",
  flagPasswordReset: "auth:flag-password-reset",
  forceResetPassword: "auth:force-reset-password",
  restoreUser: "auth:restore-user",
};

contextBridge.exposeInMainWorld("desktopAuth", {
  setupMasterUser(payload) {
    return ipcRenderer.invoke(AUTH_CHANNELS.setupMasterUser, payload);
  },
  signIn(payload) {
    return ipcRenderer.invoke(AUTH_CHANNELS.signIn, payload);
  },
  checkUsername(username) {
    return ipcRenderer.invoke(AUTH_CHANNELS.checkUsername, { username });
  },
  setInitialPassword(username, newPassword) {
    return ipcRenderer.invoke(AUTH_CHANNELS.setInitialPassword, {
      username,
      newPassword,
    });
  },
  getUserById(userId) {
    return ipcRenderer.invoke(AUTH_CHANNELS.getUserById, { userId });
  },
  getBootstrapState() {
    return ipcRenderer.invoke(AUTH_CHANNELS.getBootstrapState);
  },
  listUsers() {
    return ipcRenderer.invoke(AUTH_CHANNELS.listUsers);
  },
  createUser(payload) {
    return ipcRenderer.invoke(AUTH_CHANNELS.createUser, payload);
  },
  deactivateUser(userId) {
    return ipcRenderer.invoke(AUTH_CHANNELS.deactivateUser, { userId });
  },
  flagPasswordReset(userId) {
    return ipcRenderer.invoke(AUTH_CHANNELS.flagPasswordReset, { userId });
  },
  forceResetPassword(userId, newPassword) {
    return ipcRenderer.invoke(AUTH_CHANNELS.forceResetPassword, { userId, newPassword });
  },
  restoreUser(userId) {
    return ipcRenderer.invoke(AUTH_CHANNELS.restoreUser, { userId });
  },
});

const DB_CHANNELS = {
  getServices: "db:get-services",
  saveService: "db:save-service",
  deleteService: "db:delete-service",
  getInventory: "db:get-inventory",
  saveInventory: "db:save-inventory",
  deleteInventory: "db:delete-inventory",
  getOrders: "db:get-orders",
  getNextOrderCode: "db:get-next-order-code",
  reserveNextOrderCode: "db:reserve-next-order-code",
  createOrderWithInventory: "db:create-order-with-inventory",
  saveOrder: "db:save-order",
  deleteOrder: "db:delete-order",
  cancelOrder: "db:cancel-order",
  getOrderPayments: "db:get-order-payments",
  addOrderPayment: "db:add-order-payment",
  getOrderPartDeliveries: "db:get-order-part-deliveries",
  addOrderPartDeliveries: "db:add-order-part-deliveries",
  getClients: "db:get-clients",
  findClientByDocument: "db:find-client-by-document",
  upsertClient: "db:upsert-client",
  triggerSync: "db:trigger-sync",
  getBcvUsdRate: "db:get-bcv-usd-rate",
  refreshBcvUsdRate: "db:refresh-bcv-usd-rate",
  getBcvUsdRateStatus: "db:get-bcv-usd-rate-status",
  setManualBcvUsdRate: "db:set-manual-bcv-usd-rate",
  getLanConfig: "db:get-lan-config",
  setLanConfig: "db:set-lan-config",
  getLanStatus: "db:get-lan-status",
  discoverLanServers: "db:discover-lan-servers",
  getLocalNetworkIps: "db:get-local-network-ips",
};

const LICENSE_CHANNELS = {
  getStatus: "license:get-status",
  refresh: "license:refresh",
};

contextBridge.exposeInMainWorld("database", {
  getServices() {
    return ipcRenderer.invoke(DB_CHANNELS.getServices);
  },
  saveService(service) {
    return ipcRenderer.invoke(DB_CHANNELS.saveService, service);
  },
  deleteService(id) {
    return ipcRenderer.invoke(DB_CHANNELS.deleteService, id);
  },
  getInventory() {
    return ipcRenderer.invoke(DB_CHANNELS.getInventory);
  },
  saveInventory(item) {
    return ipcRenderer.invoke(DB_CHANNELS.saveInventory, item);
  },
  deleteInventory(id) {
    return ipcRenderer.invoke(DB_CHANNELS.deleteInventory, id);
  },
  getOrders() {
    return ipcRenderer.invoke(DB_CHANNELS.getOrders);
  },
  getNextOrderCode() {
    return ipcRenderer.invoke(DB_CHANNELS.getNextOrderCode);
  },
  reserveNextOrderCode() {
    return ipcRenderer.invoke(DB_CHANNELS.reserveNextOrderCode);
  },
  createOrderWithInventory(order) {
    return ipcRenderer.invoke(DB_CHANNELS.createOrderWithInventory, order);
  },
  saveOrder(order) {
    return ipcRenderer.invoke(DB_CHANNELS.saveOrder, order);
  },
  deleteOrder(id) {
    return ipcRenderer.invoke(DB_CHANNELS.deleteOrder, id);
  },
  cancelOrder(payload) {
    return ipcRenderer.invoke(DB_CHANNELS.cancelOrder, payload);
  },
  getOrderPayments(orderId) {
    return ipcRenderer.invoke(DB_CHANNELS.getOrderPayments, orderId);
  },
  addOrderPayment(payload) {
    return ipcRenderer.invoke(DB_CHANNELS.addOrderPayment, payload);
  },
  getOrderPartDeliveries(orderId) {
    return ipcRenderer.invoke(DB_CHANNELS.getOrderPartDeliveries, orderId);
  },
  addOrderPartDeliveries(payload) {
    return ipcRenderer.invoke(DB_CHANNELS.addOrderPartDeliveries, payload);
  },
  getClients() {
    return ipcRenderer.invoke(DB_CHANNELS.getClients);
  },
  findClientByDocument(docNormalized) {
    return ipcRenderer.invoke(DB_CHANNELS.findClientByDocument, docNormalized);
  },
  upsertClient(client) {
    return ipcRenderer.invoke(DB_CHANNELS.upsertClient, client);
  },
  triggerSync() {
    return ipcRenderer.invoke(DB_CHANNELS.triggerSync);
  },
  getBcvUsdRate() {
    return ipcRenderer.invoke(DB_CHANNELS.getBcvUsdRate);
  },
  refreshBcvUsdRate() {
    return ipcRenderer.invoke(DB_CHANNELS.refreshBcvUsdRate);
  },
  getBcvUsdRateStatus() {
    return ipcRenderer.invoke(DB_CHANNELS.getBcvUsdRateStatus);
  },
  setManualBcvUsdRate(valueUsd) {
    return ipcRenderer.invoke(DB_CHANNELS.setManualBcvUsdRate, valueUsd);
  },
  getLanConfig() {
    return ipcRenderer.invoke(DB_CHANNELS.getLanConfig);
  },
  setLanConfig(payload) {
    return ipcRenderer.invoke(DB_CHANNELS.setLanConfig, payload);
  },
  getLanStatus() {
    return ipcRenderer.invoke(DB_CHANNELS.getLanStatus);
  },
  discoverLanServers() {
    return ipcRenderer.invoke(DB_CHANNELS.discoverLanServers);
  },
  getLocalNetworkIps() {
    return ipcRenderer.invoke(DB_CHANNELS.getLocalNetworkIps);
  },
});

contextBridge.exposeInMainWorld("license", {
  getStatus() {
    return ipcRenderer.invoke(LICENSE_CHANNELS.getStatus);
  },
  refresh() {
    return ipcRenderer.invoke(LICENSE_CHANNELS.refresh);
  },
});
