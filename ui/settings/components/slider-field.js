import { Tooltip } from '../../shared/tooltip.js';
import { i18n } from '../../shared/i18n.js';

/**
 * Slider Field component for numeric range values
 */
export class SliderField {
    constructor(id, label, min = 0, max = 1, step = 0.01, defaultValue = 0.18, tooltipKey = null) {
        this.id = id;
        this.label = label;
        this.min = min;
        this.max = max;
        this.step = step;
        this.defaultValue = defaultValue;
        this.tooltipKey = tooltipKey;
        this.onChangeCallback = null;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'slider-field-container';
        container.id = `${this.id}-container`;

        const labelRow = document.createElement('div');
        labelRow.className = 'slider-label-row';

        const labelEl = document.createElement('label');
        labelEl.className = 'slider-label';
        labelEl.htmlFor = this.id;
        labelEl.textContent = this.label;
        
        
        // Attach tooltip if key provided
        if (this.tooltipKey) {
            const tooltipText = i18n.t(this.tooltipKey);
            const tooltip = new Tooltip(tooltipText, 'top');
            tooltip.attachTo(labelEl);
        }
        
        labelRow.appendChild(labelEl);
        container.appendChild(labelRow);

        // Input row with slider and value
        const inputRow = document.createElement('div');
        inputRow.className = 'slider-input-row';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = this.id;
        slider.className = 'slider-input';
        slider.min = this.min;
        slider.max = this.max;
        slider.step = this.step;
        slider.value = this.defaultValue;

        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'slider-value-display';
        valueDisplay.id = `${this.id}-value`;
        valueDisplay.textContent = this.defaultValue.toFixed(2);

        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            valueDisplay.textContent = value.toFixed(2);
            
            if (this.onChangeCallback) {
                this.onChangeCallback(value);
            }
        });

        inputRow.appendChild(slider);
        inputRow.appendChild(valueDisplay);
        container.appendChild(inputRow);

        return container;
    }

    setValue(value) {
        const slider = document.getElementById(this.id);
        const valueDisplay = document.getElementById(`${this.id}-value`);
        
        if (slider) {
            slider.value = value;
        }
        if (valueDisplay) {
            valueDisplay.textContent = parseFloat(value).toFixed(2);
        }
    }

    getValue() {
        const slider = document.getElementById(this.id);
        return slider ? parseFloat(slider.value) : this.defaultValue;
    }

    onChange(callback) {
        this.onChangeCallback = callback;
    }
}
