import store from '../../core/state.js';

class AnalysisComponent {
  constructor(element) {
    this.element = element;
    this.render();
  }

  render() {
    this.element.innerHTML = `
      <div class="section">
        <h2>Analysis</h2>
        <p>Analysis tools and reports will appear here.</p>
      </div>
    `;
  }
}

export default AnalysisComponent;
