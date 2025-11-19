// js/modules/request-manager.js

export const RequestManager = {
  // Map to track active requests by unique key
  activeRequests: new Map(),
  
  // Generate unique request keys based on endpoint and parameters
  generateRequestKey(action, apiKey, additionalParams = {}) {
    // Create a unique key for the request
    const paramsString = Object.keys(additionalParams)
      .sort()
      .map(key => `${key}=${additionalParams[key]}`)
      .join('&');
    
    return `${action}-${apiKey}${paramsString ? `-${paramsString}` : ''}`;
  },
  
  // Check if request is already in progress
  hasActiveRequest(key) {
    return this.activeRequests.has(key);
  },
  
  // Register a new request or add callback to existing request
  registerRequest(key, callback) {
    if (this.activeRequests.has(key)) {
      // If request is already in progress, add the callback to the queue
      const requestInfo = this.activeRequests.get(key);
      requestInfo.callbacks.push(callback);
      return false; // Indicates this is a duplicate request
    } else {
      // Register a new request
      this.activeRequests.set(key, {
        callbacks: [callback],
        timestamp: Date.now()
      });
      return true; // Indicates this is a new request
    }
  },
  
  // Complete a request and notify all callbacks
  completeRequest(key, response) {
    if (this.activeRequests.has(key)) {
      const requestInfo = this.activeRequests.get(key);
      
      // Notify all callbacks with the same response
      requestInfo.callbacks.forEach(callback => {
        if (typeof callback === 'function') {
          callback(response);
        }
      });
      
      // Clean up the completed request
      this.activeRequests.delete(key);
    }
  },
  
  // Cancel/abort a request and notify callbacks with error
  cancelRequest(key, errorMessage = "Request was cancelled") {
    if (this.activeRequests.has(key)) {
      const requestInfo = this.activeRequests.get(key);
      
      // Notify all callbacks with an error response
      const errorResponse = {
        success: false,
        message: errorMessage
      };
      
      requestInfo.callbacks.forEach(callback => {
        if (typeof callback === 'function') {
          callback(errorResponse);
        }
      });
      
      // Clean up the cancelled request
      this.activeRequests.delete(key);
    }
  },
  
  // Get request information for debugging
  getRequestInfo(key) {
    return this.activeRequests.get(key);
  },
  
  // Clear all active requests (use with caution)
  clearAllRequests() {
    this.activeRequests.clear();
  },
  
  // Cleanup old requests that might be stuck (e.g., requests older than 30 seconds)
  cleanupStaleRequests(maxAge = 30000) { // 30 seconds default
    const now = Date.now();
    for (const [key, requestInfo] of this.activeRequests.entries()) {
      if (now - requestInfo.timestamp > maxAge) {
        this.cancelRequest(key, "Request timed out due to inactivity");
      }
    }
  }
};