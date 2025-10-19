/**
 * Reusable password field component with visibility toggle
 */
export class PasswordField {
    constructor(id, label, placeholder) {
        this.id = id;
        this.label = label;
        this.placeholder = placeholder;
        this.changeCallback = null;
    }
    
    onChange(callback) {
        this.changeCallback = callback;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'form-group';
        container.id = `${this.id}-group`;
        
        container.innerHTML = `
            <label for="${this.id}">${this.label}</label>
            <div class="input-with-eye">
                <input 
                    type="password" 
                    id="${this.id}" 
                    placeholder="${this.placeholder}"
                    autocomplete="off"
                />
                <button id="toggle-${this.id}" class="eye-toggle" type="button">
                    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="#b0b0b0">
                        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                        <g id="SVGRepo_iconCarrier">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M1 10c0-3.9 3.1-7 7-7s7 3.1 7 7h-1c0-3.3-2.7-6-6-6s-6 2.7-6 6H1zm4 0c0-1.7 1.3-3 3-3s3 1.3 3 3-1.3 3-3 3-3-1.3-3-3zm1 0c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z"></path>
                        </g>
                    </svg>
                </button>
            </div>
        `;
        
        // Add toggle functionality
        const input = container.querySelector(`#${this.id}`);
        const toggleBtn = container.querySelector(`#toggle-${this.id}`);
        
        toggleBtn.addEventListener('click', () => {
            input.type = input.type === 'password' ? 'text' : 'password';
        });
        
        // Add change listener
        input.addEventListener('input', () => {
            if (this.changeCallback) {
                this.changeCallback(input.value);
            }
        });
        
        return container;
    }

    getValue() {
        return document.getElementById(this.id)?.value || '';
    }

    setValue(value) {
        const input = document.getElementById(this.id);
        if (input) input.value = value;
    }
}
