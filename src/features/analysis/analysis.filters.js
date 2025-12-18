export default class AnalysisFilters {
  constructor(element, callbacks) {
    this.element = element;
    this.callbacks = callbacks || {}; // { onFilterChange, onSearchChange }
    this.render();
    this.bindEvents();
  }

  render() {
    this.element.innerHTML = `
             <div class="section-header">Filter Specific Tags</div>
             <div class="tag-filters-container">
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
  }

  updateInputs(catTerm, tripTerm) {
    const catInput = this.element.querySelector("#analysis-cat-search");
    if (catInput) catInput.value = catTerm;

    const tripInput = this.element.querySelector("#analysis-trip-search");
    if (tripInput) tripInput.value = tripTerm;
  }

  renderTagLists(
    tagsData,
    selectedCategories,
    selectedTrips,
    catTerm,
    tripTerm
  ) {
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

  populateTagList(type, tagsArray, selectionSet, searchTerm, containerId) {
    const container = this.element.querySelector(containerId);
    if (!container) return;

    container.innerHTML = "";

    if (tagsArray.length === 0) {
      container.innerHTML = '<div style="padding:5px;">No tags found</div>';
      return;
    }

    const sortedTags = [...tagsArray].sort();
    const visibleTags = sortedTags.filter((tag) =>
      tag.toLowerCase().includes(searchTerm)
    );

    // "Select All" Option
    if (visibleTags.length > 0) {
      const selectAllDiv = document.createElement("div");
      selectAllDiv.className = "tag-checkbox-item";
      const uid = `analysis-all-${type.replace("/", "-")}`;
      selectAllDiv.innerHTML = `<input type="checkbox" id="${uid}" /> <label for="${uid}"><em>Select All</em></label>`;

      const allVisibleSelected = visibleTags.every((t) => selectionSet.has(t));
      const checkbox = selectAllDiv.querySelector("input");
      checkbox.checked =
        allVisibleSelected && visibleTags.length > 0 && selectionSet.size > 0;

      checkbox.addEventListener("change", (e) => {
        visibleTags.forEach((tag) => {
          if (e.target.checked) selectionSet.add(tag);
          else selectionSet.delete(tag);
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
      const isChecked = selectionSet.has(tag);
      const uid = `analysis-${type.replace("/", "-")}-${tag.replace(
        /\s+/g,
        "-"
      )}`;
      div.innerHTML = `
                <input type="checkbox" id="${uid}" value="${tag}" class="tag-item-input" ${
        isChecked ? "checked" : ""
      }>
                <label for="${uid}">${tag}</label>
            `;
      const input = div.querySelector("input");
      input.addEventListener("change", (e) => {
        if (e.target.checked) selectionSet.add(tag);
        else selectionSet.delete(tag);

        if (this.callbacks.onFilterChange) {
          this.callbacks.onFilterChange();
        }
      });
      container.appendChild(div);
    });
  }
}
