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
        
        const select = document.createElement('select');
        select.id = this.id;
        select.className = 'custom-select';
        
        this.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });
        
        container.appendChild(labelEl);
        container.appendChild(select);
        
        return container;
    }

    getValue() {
        return document.getElementById(this.id)?.value || '';
    }

    setValue(value) {
        const select = document.getElementById(this.id);
        if (select) select.value = value;
    }

    onChange(callback) {
        const select = document.getElementById(this.id);
        if (select) {
            select.addEventListener('change', () => callback(select.value));
        }
    }
}
