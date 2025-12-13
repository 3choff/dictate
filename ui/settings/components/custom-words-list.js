import { i18n } from '../../shared/i18n.js';

/**
 * Custom Words List component for managing word corrections
 */
export class CustomWordsList {
    constructor(id, label) {
        this.id = id;
        this.label = label;
        this.words = [];
        this.onChangeCallback = null;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'custom-words-container';
        container.id = `${this.id}-container`;

        // Label
        const labelEl = document.createElement('label');
        labelEl.className = 'custom-words-label';
        labelEl.textContent = this.label;
        container.appendChild(labelEl);

        // Input row
        const inputRow = document.createElement('div');
        inputRow.className = 'custom-words-input-row';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = this.id;
        input.className = 'custom-words-input';
        input.placeholder = i18n.t('transcription.customWordsPlaceholder');
        inputRow.appendChild(input);

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'custom-words-add-btn';
        addButton.textContent = i18n.t('transcription.addButton');
        addButton.addEventListener('click', () => this.addWord());
        inputRow.appendChild(addButton);

        container.appendChild(inputRow);

        // Enter key to add
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addWord();
            }
        });

        // Words list
        const wordsList = document.createElement('div');
        wordsList.className = 'custom-words-list';
        wordsList.id = `${this.id}-list`;
        container.appendChild(wordsList);

        return container;
    }

    addWord() {
        const input = document.getElementById(this.id);
        const word = input.value.trim();
        
        if (word && !this.words.includes(word)) {
            this.words.push(word);
            this.renderWordsList();
            input.value = '';
            
            if (this.onChangeCallback) {
                this.onChangeCallback(this.words);
            }
        }
    }

    removeWord(word) {
        this.words = this.words.filter(w => w !== word);
        this.renderWordsList();
        
        if (this.onChangeCallback) {
            this.onChangeCallback(this.words);
        }
    }

    renderWordsList() {
        const listEl = document.getElementById(`${this.id}-list`);
        if (!listEl) return;

        listEl.innerHTML = '';

        if (this.words.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'custom-words-empty';
            emptyMsg.textContent = i18n.t('transcription.noCustomWords');
            listEl.appendChild(emptyMsg);
            return;
        }

        this.words.forEach(word => {
            const wordTag = document.createElement('div');
            wordTag.className = 'custom-words-tag';

            const wordText = document.createElement('span');
            wordText.className = 'custom-words-tag-text';
            wordText.textContent = word;
            wordTag.appendChild(wordText);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'custom-words-remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.addEventListener('click', () => this.removeWord(word));
            wordTag.appendChild(removeBtn);

            listEl.appendChild(wordTag);
        });
    }

    setValue(words) {
        this.words = Array.isArray(words) ? [...words] : [];
        this.renderWordsList();
    }

    getValue() {
        return [...this.words];
    }

    onChange(callback) {
        this.onChangeCallback = callback;
    }
}
