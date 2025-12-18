import { formatCurrency } from "../../core/utils.js";

export default class AnalysisChart {
  constructor(element) {
    this.element = element; // The canvas element or container
    this.chartInstance = null;
    this.libLoaded = false;
    this.loadLib();
  }

  loadLib() {
    if (window.Chart) {
      this.libLoaded = true;
      return;
    }

    const script = document.createElement("script");
    script.src = "src/lib/chart.umd.min.js";
    script.onload = () => {
      this.libLoaded = true;
      console.log("Chart.js loaded");
    };
    script.onerror = () => {
      console.error("Failed to load Chart.js");
    };
    document.head.appendChild(script);
  }

  render(data, options) {
    if (!this.libLoaded) {
      console.warn("Chart.js not loaded yet");
      return;
    }

    const ctx = this.element.getContext("2d");
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
                if (context.parsed.y !== null) {
                  label += formatCurrency(context.parsed.y);
                }
                return label;
              },
              footer: function (tooltipItems) {
                let sum = 0;
                tooltipItems.forEach(function (tooltipItem) {
                  sum += tooltipItem.parsed.y;
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
}
