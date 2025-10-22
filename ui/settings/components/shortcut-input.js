/**
 * Reusable shortcut input component
 * Captures keyboard combinations when focused
 */
export class ShortcutInput {
    constructor(id, label, defaultValue = '', description = '') {
        this.id = id;
        this.label = label;
        this.defaultValue = defaultValue;
        this.description = description;
        this.changeCallback = null;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'form-group shortcut-group';
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'shortcut-label-container';
        
        const labelEl = document.createElement('label');
        labelEl.htmlFor = this.id;
        labelEl.textContent = this.label;
        labelDiv.appendChild(labelEl);
        
        // if (this.description) {
        //     const desc = document.createElement('span');
        //     desc.className = 'shortcut-description';
        //     desc.textContent = this.description;
        //     labelDiv.appendChild(desc);
        // }
        
        const inputContainer = document.createElement('div');
        inputContainer.className = 'shortcut-input-container';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = this.id;
        input.className = 'shortcut-input';
        input.readOnly = true;
        input.placeholder = 'Press keys...';
        
        // Capture key combinations on keyup (when user releases keys)
        let capturedShortcut = null;
        let oldValue = '';
        
        input.addEventListener('keydown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Build shortcut string from pressed keys
            const parts = [];
            if (e.ctrlKey) parts.push('Ctrl');
            if (e.altKey) parts.push('Alt');
            if (e.shiftKey) parts.push('Shift');
            if (e.metaKey) parts.push('Meta');
            
            // Add the main key (exclude modifier keys themselves)
            const key = e.key;
            if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
                // Normalize key representation
                const normalizedKey = this.normalizeKey(key);
                if (normalizedKey) {
                    parts.push(normalizedKey);
                }
            }
            
            // Need at least modifier + key
            if (parts.length >= 2) {
                capturedShortcut = parts.join('+');
                input.value = capturedShortcut;
            }
        });
        
        // Save on keyup (when user releases the keys)
        input.addEventListener('keyup', (e) => {
            if (capturedShortcut) {
                // Trigger callback
                if (this.changeCallback) {
                    this.changeCallback(capturedShortcut);
                }
                // Dispatch change event for global auto-save listener
                input.dispatchEvent(new Event('change', { bubbles: true }));
                capturedShortcut = null;
                // Exit capturing mode
                input.blur();
            }
        });
        
        // Clear input and prepare for new combination on focus
        input.addEventListener('focus', () => {
            oldValue = input.value; // Save old value
            input.value = '';
            input.placeholder = 'Press key combination...';
            input.classList.add('shortcut-capturing');
        });
        
        input.addEventListener('blur', () => {
            // Restore old value if no new shortcut was entered
            if (!input.value && oldValue) {
                input.value = oldValue;
            }
            input.placeholder = 'Press keys...';
            input.classList.remove('shortcut-capturing');
            oldValue = ''; // Clear old value
        });
        
        // Restore to default button
        const restoreBtn = document.createElement('button');
        restoreBtn.type = 'button';
        restoreBtn.className = 'shortcut-restore-btn';
        restoreBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
            </svg>
        `;
        restoreBtn.title = 'Restore to default';
        restoreBtn.addEventListener('click', () => {
            input.value = this.defaultValue;
            if (this.changeCallback) {
                this.changeCallback(this.defaultValue);
            }
            // Dispatch change event for global auto-save listener
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        
        inputContainer.appendChild(input);
        inputContainer.appendChild(restoreBtn);
        
        container.appendChild(labelDiv);
        container.appendChild(inputContainer);
        
        return container;
    }

    normalizeKey(key) {
        // Normalize special keys
        const keyMap = {
            ' ': 'Space',
            'Enter': 'Enter',
            'Tab': 'Tab',
            'Escape': 'Esc',
            'Backspace': 'Backspace',
            'Delete': 'Delete',
            'ArrowUp': 'Up',
            'ArrowDown': 'Down',
            'ArrowLeft': 'Left',
            'ArrowRight': 'Right',
        };
        
        if (keyMap[key]) {
            return keyMap[key];
        }
        
        // Single letter/number keys - uppercase
        if (key.length === 1) {
            return key.toUpperCase();
        }
        
        return null;
    }

    getValue() {
        return document.getElementById(this.id)?.value || '';
    }

    setValue(value) {
        const input = document.getElementById(this.id);
        if (input) {
            input.value = value;
        }
    }

    onChange(callback) {
        this.changeCallback = callback;
    }
}
