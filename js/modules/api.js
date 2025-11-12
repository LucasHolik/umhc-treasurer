// js/modules/api.js

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyOuvUpzAAW2E75NjK7oeOixQRgxdyIRzl6c-qsX_8pyrwxbPK_w6SgQMdmsP1P8s8/exec";

function jsonpRequest(url, callback) {
  const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
  const script = document.createElement('script');

  window[callbackName] = function (data) {
    callback(data);
    document.body.removeChild(script);
    delete window[callbackName];
  };

  script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + callbackName;
  document.body.appendChild(script);
}

export const API = {
  login(apiKey, callback) {
    const url = `${SCRIPT_URL}?apiKey=${encodeURIComponent(apiKey)}`;
    jsonpRequest(url, callback);
  },

  getData(apiKey, callback) {
    const url = `${SCRIPT_URL}?action=getData&apiKey=${encodeURIComponent(apiKey)}`;
    jsonpRequest(url, callback);
  },

  getAppData(apiKey, callback) {
    const url = `${SCRIPT_URL}?action=getAppData&apiKey=${encodeURIComponent(apiKey)}`;
    jsonpRequest(url, callback);
  },

  saveData(apiKey, data, callback) {
    const stringifiedData = JSON.stringify(data);
    const url = `${SCRIPT_URL}?action=saveData&apiKey=${encodeURIComponent(apiKey)}&data=${encodeURIComponent(stringifiedData)}`;
    jsonpRequest(url, callback);
  },

  addTag(apiKey, type, value, callback) {
    const url = `${SCRIPT_URL}?action=addTag&apiKey=${encodeURIComponent(apiKey)}&type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`;
    jsonpRequest(url, callback);
  },

  updateExpenses(apiKey, data, callback) {
    const stringifiedData = JSON.stringify(data);
    const url = `${SCRIPT_URL}?action=updateExpenses&apiKey=${encodeURIComponent(apiKey)}&data=${encodeURIComponent(stringifiedData)}`;
    jsonpRequest(url, callback);
  }
};
