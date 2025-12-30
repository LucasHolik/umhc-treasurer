import { formatCurrency } from "../../core/utils.js";

export default class AnalysisChart {
  constructor(element) {
    this.element = element; // The canvas element or container
    this.chartInstance = null;
    this.libLoaded = false;
    this.pendingRender = null;
    this.loadLib();
  }

  loadLib() {
    if (this.libLoaded || window.Chart) {
      this.libLoaded = true;
      return;
    }

    const scriptSrc = "src/lib/chart.umd.min.js";
    let script = document.querySelector(`script[src="${scriptSrc}"]`);

    const handleLoad = () => {
      if (this.libLoaded) return;
      this.libLoaded = true;
      console.log("Chart.js loaded");
      if (this.pendingRender) {
        this.render(this.pendingRender.data, this.pendingRender.options);
        this.pendingRender = null;
      }
    };

    const handleError = () => {
      console.error("Failed to load Chart.js");
      this.pendingRender = null;
    };

    if (script) {
      script.addEventListener("load", handleLoad);
      script.addEventListener("error", handleError);

      // Race condition fix: Check if it finished loading while we were attaching listeners
      if (window.Chart) {
        script.removeEventListener("load", handleLoad);
        script.removeEventListener("error", handleError);
        handleLoad();
      }
    } else {
      script = document.createElement("script");
      script.src = scriptSrc;
      script.addEventListener("load", handleLoad);
      script.addEventListener("error", handleError);
      document.head.appendChild(script);
    }
  }

  render(data, options) {
    if (!this.libLoaded) {
      this.pendingRender = { data, options };
      return;
    }

    if (!this.element || this.element.tagName !== "CANVAS") {
      console.error("AnalysisChart requires a canvas element");
      return;
    }

    const ctx = this.element.getContext("2d");
    if (!ctx) {
      console.error("Failed to get 2D context from canvas element");
      return;
    }
    const { labels, datasets } = data;
    const { type, metric, primaryGroup, secondaryGroup } = options;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    // Determine actual chart type based on config
    let chartType = type;
    if (secondaryGroup !== "none" && (type === "pie" || type === "doughnut")) {
      chartType = "bar";
    }
    if (
      metric === "balance" &&
      primaryGroup === "date" &&
      secondaryGroup === "none"
    ) {
      chartType = "line";
    }

    const config = {
      type: chartType,
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#fff" },
            display: true,
          },
          title: {
            display: true,
            text: `Analysis: ${metric.toUpperCase()} by ${primaryGroup}${
              secondaryGroup !== "none" ? " & " + secondaryGroup : ""
            }`,
            color: "#f0ad4e",
            font: { size: 16 },
          },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || "";
                if (label) {
                  label += ": ";
                }
                const value =
                  context.parsed.y !== undefined
                    ? context.parsed.y
                    : context.parsed;
                if (value !== null) {
                  label += formatCurrency(value);
                }
                return label;
              },
              footer: function (tooltipItems) {
                let sum = 0;
                tooltipItems.forEach(function (tooltipItem) {
                  const value =
                    tooltipItem.parsed.y !== undefined
                      ? tooltipItem.parsed.y
                      : tooltipItem.parsed;
                  sum += value;
                });
                if (tooltipItems.length > 1) {
                  return "Total: " + formatCurrency(sum);
                }
                return "";
              },
            },
          },
        },
        scales:
          chartType === "pie" || chartType === "doughnut"
            ? {}
            : {
                y: {
                  stacked: secondaryGroup !== "none",
                  ticks: { color: "#ccc" },
                  grid: { color: "rgba(255,255,255,0.1)" },
                },
                x: {
                  stacked: secondaryGroup !== "none",
                  ticks: { color: "#ccc" },
                  grid: { color: "rgba(255,255,255,0.1)" },
                },
              },
      },
    };

    this.chartInstance = new Chart(ctx, config);
  }

  toBase64Image() {
    if (!this.chartInstance) return null;
    return this.chartInstance.toBase64Image();
  }

  destroy() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }
}
