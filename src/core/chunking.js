
export const Chunker = {
  /**
   * Sends data in chunks to respect URL length limits.
   *
   * @param {Function} requestFn - The generic request function (e.g. ApiService.request)
   * @param {string} action - The action name (e.g., 'saveData')
   * @param {object} fixedParams - Parameters that stay constant (e.g. { type: '...' })
   * @param {Array} dataArray - The array of data items to split
   * @param {string} dataKey - The parameter key for the data (e.g., 'data' or 'operations')
   * @param {Function} onProgress - Callback (processedCount, totalCount)
   * @param {number} maxUrlLength - The hard limit for the URL (default 2000, plan said 150 but that is impossibly low for total URL)
   * @param {string} baseUrl - The base script URL
   * @param {string} apiKey - The API key
   */
  sendChunkedRequest: async (
    requestFn,
    action,
    fixedParams,
    dataArray,
    dataKey = "data",
    onProgress = null,
    maxUrlLength = 2000, 
    baseUrl = "",
    apiKey = ""
  ) => {
    if (!dataArray || dataArray.length === 0) {
      return requestFn(action, fixedParams);
    }

    const totalCount = dataArray.length;
    let processedCount = 0;
    let currentIndex = 0;

    // Estimate overhead
    // Base URL + ?action=...&apiKey=...&callback=...
    // callback is approx "jsonp_callback_" + 5 digits = ~20 chars
    const baseOverhead =
      baseUrl.length +
      "?action=".length +
      action.length +
      "&apiKey=".length +
      apiKey.length +
      "&callback=jsonp_callback_12345".length;

    // Add fixed params overhead
    let fixedParamsStr = "";
    for (const key in fixedParams) {
        fixedParamsStr += `&${key}=${encodeURIComponent(fixedParams[key])}`;
    }
    const fixedOverhead = fixedParamsStr.length;
    
    // Total static overhead
    const overhead = baseOverhead + fixedOverhead + `&${dataKey}=`.length;

    while (currentIndex < totalCount) {
      let chunk = [];
      let nextIndex = currentIndex;
      
      // Always add at least one item to avoid infinite loop if one item is huge
      chunk.push(dataArray[nextIndex]);
      nextIndex++;

      // Try to add more items
      while (nextIndex < totalCount) {
        const item = dataArray[nextIndex];
        const potentialChunk = [...chunk, item];
        const encodedData = encodeURIComponent(JSON.stringify(potentialChunk));
        
        if (overhead + encodedData.length <= maxUrlLength) {
            chunk.push(item);
            nextIndex++;
        } else {
            // Full, stop here
            break;
        }
      }

      // Send the chunk
      const params = { ...fixedParams, [dataKey]: JSON.stringify(chunk) };
      await requestFn(action, params, { skipLoading: true }); // We handle loading/progress manually if needed, or rely on global

      processedCount += chunk.length;
      if (onProgress) {
        onProgress(processedCount, totalCount);
      }
      
      currentIndex = nextIndex;
    }

    return { success: true, message: `Processed ${processedCount} items in chunks.` };
  },
};
