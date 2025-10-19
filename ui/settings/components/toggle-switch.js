/**
 * Reusable toggle switch component
 */
export class ToggleSwitch {
    constructor(id, label) {
        this.id = id;
        this.label = label;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'form-group toggle-row';
        
        container.innerHTML = `
            <span class="toggle-label">${this.label}</span>
            <label class="toggle-switch" for="${this.id}">
                <input type="checkbox" id="${this.id}" />
                <span class="toggle-track"></span>
            </label>
        `;
        
        return container;
    }

    getValue() {
        return document.getElementById(this.id)?.checked || false;
    }

    setValue(checked) {
        const input = document.getElementById(this.id);
        if (input) input.checked = checked;
    }

    onChange(callback) {
        const input = document.getElementById(this.id);
        if (input) {
            input.addEventListener('change', () => callback(input.checked));
        }
    }
}
