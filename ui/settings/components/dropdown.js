export class Dropdown {
    constructor(id, label, options, selectedValue) {
        this.id = id;
        this.label = label;
        this.options = options; // [{ value, label }]
        this.value = selectedValue;
        this.element = null;
        this.onChange = null;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'setting-row dropdown-row';
        
        const label = document.createElement('label');
        label.className = 'setting-label';
        label.htmlFor = this.id;
        label.textContent = this.label;
        container.appendChild(label);

        const wrapper = document.createElement('div');
        wrapper.className = 'focus-gradient-border';

        const select = document.createElement('select');
        select.id = this.id;
        select.className = 'settings-dropdown';
        
        this.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === this.value) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            this.value = e.target.value;
            if (this.onChange) {
                this.onChange(this.value);
            }
        });

        wrapper.appendChild(select);
        container.appendChild(wrapper);
        
        this.element = select;
        return container;
    }

    setValue(value) {
        this.value = value;
        if (this.element) {
            this.element.value = value;
        }
    }
    
    getValue() {
        return this.value;
    }

    setOnChange(callback) {
        this.onChange = callback;
    }
}
