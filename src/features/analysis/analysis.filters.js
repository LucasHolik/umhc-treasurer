export default class AnalysisFilters {
  constructor(element, callbacks) {
    this.element = element;
    this.callbacks = callbacks || {}; // { onFilterChange, onSearchChange, onTypeChange }
    this.render();
    this.bindEvents();
  }

  render() {
    this.element.innerHTML = `
             <div class="section-header">Filter Specific Tags</div>
             <div class="tag-filters-container">
                <!-- Type Filter -->
                <div class="tag-filter-column">
                    <div class="tag-filter-header">Types</div>
                    <input type="text" id="analysis-type-search" aria-label="Search Types" class="tag-search-input" placeholder="Search types...">
                    <div id="type-selector-container" class="tag-selector">
                        <div style="padding: 5px; color: rgba(255,255,255,0.5);">Loading...</div>
                    </div>
                </div>

                <!-- Trip Filter -->
                <div class="tag-filter-column">
                    <div class="tag-filter-header">Trips / Events</div>
                    <input type="text" id="analysis-trip-search" aria-label="Search Trips" class="tag-search-input" placeholder="Search trips...">
                    <div id="trip-selector-container" class="tag-selector">
                        <div style="padding: 5px; color: rgba(255,255,255,0.5);">Loading...</div>
                    </div>
                </div>

                <!-- Category Filter -->
                <div class="tag-filter-column">
                    <div class="tag-filter-header">Categories</div>
                    <input type="text" id="analysis-cat-search" aria-label="Search Categories" class="tag-search-input" placeholder="Search categories...">
                    <div id="category-selector-container" class="tag-selector">
                        <div style="padding: 5px; color: rgba(255,255,255,0.5);">Loading...</div>
                    </div>
                </div>
            </div>
        `;
  }

  bindEvents() {
    const catSearch = this.element.querySelector("#analysis-cat-search");
    if (catSearch) {
      catSearch.addEventListener("input", (e) => {
        if (this.callbacks.onSearchChange) {
          this.callbacks.onSearchChange("Category", e.target.value);
        }
      });
    }

    const tripSearch = this.element.querySelector("#analysis-trip-search");
    if (tripSearch) {
      tripSearch.addEventListener("input", (e) => {
        if (this.callbacks.onSearchChange) {
          this.callbacks.onSearchChange("Trip/Event", e.target.value);
        }
      });
    }

    const typeSearch = this.element.querySelector("#analysis-type-search");
    if (typeSearch) {
      typeSearch.addEventListener("input", (e) => {
        if (this.callbacks.onSearchChange) {
          this.callbacks.onSearchChange("Type", e.target.value);
        }
      });
    }
  }

  updateInputs(catTerm, tripTerm, typeTerm) {
    const catInput = this.element.querySelector("#analysis-cat-search");
    if (catInput) catInput.value = catTerm || "";

    const tripInput = this.element.querySelector("#analysis-trip-search");
    if (tripInput) tripInput.value = tripTerm || "";

    const typeInput = this.element.querySelector("#analysis-type-search");
    if (typeInput) typeInput.value = typeTerm || "";
  }

  renderTagLists(
    tagsData,
    selectedCategories,
    selectedTrips,
    typeStatusMap,
    catTerm,
    tripTerm,
    typeTerm
  ) {
    this.populateTagList(
      "Type",
      tagsData["Type"] || [],
      null,
      typeTerm,
      "#type-selector-container",
      (tag, isChecked) => {
        if (this.callbacks.onTypeChange) {
          this.callbacks.onTypeChange(tag, isChecked);
        }
      },
      typeStatusMap
    );

    this.populateTagList(
      "Category",
      tagsData["Category"] || [],
      selectedCategories,
      catTerm,
      "#category-selector-container"
    );

    this.populateTagList(
      "Trip/Event",
      tagsData["Trip/Event"] || [],
      selectedTrips,
      tripTerm,
      "#trip-selector-container"
    );
  }

  populateTagList(
    type,
    tagsArray,
    selectionSet,
    searchTerm,
    containerId,
    onItemChange = null,
    statusMap = null
  ) {
    const container = this.element.querySelector(containerId);
    if (!container) return;

    container.innerHTML = "";

    if (!tagsArray || tagsArray.length === 0) {
      container.innerHTML = '<div style="padding:5px;">No tags found</div>';
      return;
    }

    const sortedTags = [...tagsArray].sort();
    const visibleTags = sortedTags.filter((tag) =>
      tag.toLowerCase().includes((searchTerm || "").toLowerCase())
    );

    // "Select All" Option
    if (visibleTags.length > 0) {
      const selectAllDiv = document.createElement("div");
      selectAllDiv.className = "tag-checkbox-item";
      const uid = `analysis-all-${type.replace("/", "-")}`;
      selectAllDiv.innerHTML = `<input type="checkbox" id="${uid}" /> <label for="${uid}"><em>Select All</em></label>`;

      let allVisibleSelected = false;
      if (statusMap) {
        allVisibleSelected = visibleTags.every(
          (t) => statusMap[t] === "checked"
        );
      } else if (selectionSet) {
        allVisibleSelected = visibleTags.every((t) => selectionSet.has(t));
      }

      const checkbox = selectAllDiv.querySelector("input");
      checkbox.checked = allVisibleSelected && visibleTags.length > 0;

      checkbox.addEventListener("change", (e) => {
        visibleTags.forEach((tag) => {
          // For statusMap mode, we rely on the callback to handle logic
          // For Set mode, we update the Set directly here (as before)
          if (selectionSet) {
            if (e.target.checked) selectionSet.add(tag);
            else selectionSet.delete(tag);
          }

          // Trigger callback
          // Note: For statusMap, we pass e.target.checked. The parent must handle "Select All" logic if needed.
          // However, here we iterate and trigger for EACH item.
          // Optimization: Ideally the parent handles "Select All" bulk operation,
          // but sticking to existing pattern of iterating items:
          if (statusMap) {
            if (onItemChange) onItemChange(tag, e.target.checked);
          } else {
            const wasSelected = selectionSet.has(tag); // Already updated above, logic slightly circular if I use 'wasSelected' from before update.
            // Simplified: Just trigger callback with new state.
            if (onItemChange) onItemChange(tag, e.target.checked);
          }
        });

        if (this.callbacks.onFilterChange) {
          this.callbacks.onFilterChange();
        }
      });
      container.appendChild(selectAllDiv);
    }

    if (visibleTags.length === 0) {
      container.innerHTML +=
        '<div style="padding:5px; color:#ccc;">No matches found</div>';
    }

    visibleTags.forEach((tag) => {
      const div = document.createElement("div");
      div.className = "tag-checkbox-item";

      let isChecked = false;
      let isIndeterminate = false;

      if (statusMap) {
        const status = statusMap[tag] || "unchecked";
        isChecked = status === "checked";
        isIndeterminate = status === "indeterminate";
      } else if (selectionSet) {
        isChecked = selectionSet.has(tag);
      }

      const uid = `analysis-${type.replace("/", "-")}-${tag.replace(
        /\s+/g,
        "-"
      )}`;
      div.innerHTML = `
                <input type="checkbox" id="${uid}" value="${tag}" class="tag-item-input">
                <label for="${uid}">${tag}</label>
            `;
      const input = div.querySelector("input");
      input.checked = isChecked;
      input.indeterminate = isIndeterminate;

      input.addEventListener("change", (e) => {
        if (selectionSet) {
          if (e.target.checked) selectionSet.add(tag);
          else selectionSet.delete(tag);
        }

        if (onItemChange) {
          onItemChange(tag, e.target.checked);
        }

        if (this.callbacks.onFilterChange) {
          this.callbacks.onFilterChange();
        }
      });
      container.appendChild(div);
    });
  }
}
