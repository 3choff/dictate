/**
 * Reusable select dropdown component
 */
export class SelectField {
    constructor(id, label, options) {
        this.id = id;
        this.label = label;
        this.options = options; // Array of {value, label}
    }

    render() {
        const container = document.createElement('div');
        container.className = 'form-group';
        
        const labelEl = document.createElement('label');
        labelEl.htmlFor = this.id;
        labelEl.textContent = this.label;
        
        // Gradient border wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'focus-gradient-border';

        const select = document.createElement('select');
        select.id = this.id;
        select.className = 'custom-select';
        
        this.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });
        
        wrapper.appendChild(select);
        container.appendChild(labelEl);
        container.appendChild(wrapper);
        
        return container;
    }

    getValue() {
        return document.getElementById(this.id)?.value || '';
    }

    setValue(value) {
        const select = document.getElementById(this.id);
        if (select) {
            // Use selectedIndex to force visual update
            const optionIndex = Array.from(select.options).findIndex(opt => opt.value === value);
            if (optionIndex !== -1) {
                select.selectedIndex = optionIndex;
            }
        }
    }

    onChange(callback) {
        const select = document.getElementById(this.id);
        if (select) {
            select.addEventListener('change', () => callback(select.value));
        }
    }
}
