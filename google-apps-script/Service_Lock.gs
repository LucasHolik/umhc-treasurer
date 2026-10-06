// google-apps-script/Service_Lock.gs
//
// The single place that takes the script lock. Every service routes through
// withScriptLock instead of calling LockService directly.
//
// GAS gives each execution its own global scope, so this depth counter is per
// request. It records whether this execution already holds the lock, which
// makes nesting explicit: an inner call (e.g. a tag batch calling
// removeTagFromExpenses) runs straight through instead of waiting on, or
// releasing, the lock its caller holds. LockService documents neither nesting
// nor reentrancy, so we never rely on it.
let _scriptLockDepth = 0;

const Service_Lock = {
  /**
   * Runs fn while holding the script lock and returns its result. If this
   * execution already holds the lock, runs fn directly without taking or
   * releasing it, so an inner call can never release an outer lock early.
   *
   * INVARIANT: CONFIG.LOCK_TIMEOUT_MS must stay well below the client's read
   * and write timeouts (src/services/api.service.js), so a caller hears
   * "System is busy" instead of timing out with the outcome unknown.
   *
   * @param {function(): *} fn
   * @param {number} [timeoutMs] - defaults to CONFIG.LOCK_TIMEOUT_MS
   * @returns {*} fn's return value, or a busy response if the lock is taken
   */
  withScriptLock: function (fn, timeoutMs) {
    if (_scriptLockDepth > 0) {
      _scriptLockDepth++;
      try {
        return fn();
      } finally {
        _scriptLockDepth--;
      }
    }

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(timeoutMs || CONFIG.LOCK_TIMEOUT_MS)) {
      // The client matches this exact text (SERVER_BUSY_MESSAGE in
      // src/services/api.service.js); change both together.
      return { success: false, message: "System is busy. Please try again." };
    }
    _scriptLockDepth = 1;
    try {
      return fn();
    } finally {
      _scriptLockDepth = 0;
      lock.releaseLock();
    }
  },
};
