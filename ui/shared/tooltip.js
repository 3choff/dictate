/**
 * Reusable tooltip component
 * Displays helpful information on hover
 */
export class Tooltip {
    constructor(text, position = 'top') {
        this.text = text;
        this.position = position; // 'top', 'bottom', 'left', 'right'
        this.tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Attach tooltip to an existing element
     * @param {HTMLElement} element - The element to attach the tooltip to
     */
    attachTo(element) {
        if (!element) return;

        element.classList.add('has-tooltip');
        element.setAttribute('data-tooltip-id', this.tooltipId);
        
        // Create tooltip element
        const tooltip = this.createTooltipElement();
        document.body.appendChild(tooltip);

        // Show on hover
        element.addEventListener('mouseenter', () => {
            this.show(element, tooltip);
        });

        // Hide on leave
        element.addEventListener('mouseleave', () => {
            this.hide(tooltip);
        });

        // Clean up on element removal
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === element) {
                        tooltip.remove();
                        observer.disconnect();
                    }
                });
            });
        });
        
        if (element.parentNode) {
            observer.observe(element.parentNode, { childList: true });
        }

        return element;
    }

    /**
     * Create a wrapper with tooltip for new content
     * @param {string} content - HTML content or text
     * @returns {HTMLElement}
     */
    wrap(content) {
        const wrapper = document.createElement('span');
        wrapper.className = 'tooltip-wrapper';
        wrapper.innerHTML = content;
        return this.attachTo(wrapper);
    }

    /**
     * Create the tooltip DOM element
     * @private
     */
    createTooltipElement() {
        const tooltip = document.createElement('div');
        tooltip.className = `tooltip tooltip-${this.position}`;
        tooltip.id = this.tooltipId;
        tooltip.textContent = this.text;
        tooltip.style.display = 'none';
        return tooltip;
    }

    /**
     * Show the tooltip
     * @private
     */
    show(targetElement, tooltip) {
        const rect = targetElement.getBoundingClientRect();
        tooltip.style.display = 'block';
        
        // Wait for next frame to get actual tooltip dimensions
        requestAnimationFrame(() => {
            const tooltipRect = tooltip.getBoundingClientRect();
            const gap = 8; // Distance from target element

            let left, top;

            switch (this.position) {
                case 'top':
                    left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                    top = rect.top - tooltipRect.height - gap;
                    break;
                case 'bottom':
                    left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                    top = rect.bottom + gap;
                    break;
                case 'left':
                    left = rect.left - tooltipRect.width - gap;
                    top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                    break;
                case 'right':
                    left = rect.right + gap;
                    top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                    break;
                default:
                    left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                    top = rect.top - tooltipRect.height - gap;
            }

            // Keep tooltip within viewport bounds
            const padding = 8;
            left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));
            top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
            tooltip.classList.add('tooltip-visible');
        });
    }

    /**
     * Hide the tooltip
     * @private
     */
    hide(tooltip) {
        tooltip.classList.remove('tooltip-visible');
        setTimeout(() => {
            tooltip.style.display = 'none';
        }, 150); // Match CSS transition duration
    }

    /**
     * Update tooltip text
     */
    setText(newText) {
        this.text = newText;
        const tooltip = document.getElementById(this.tooltipId);
        if (tooltip) {
            tooltip.textContent = newText;
        }
    }

    /**
     * Remove tooltip completely
     */
    destroy() {
        const tooltip = document.getElementById(this.tooltipId);
        if (tooltip) {
            tooltip.remove();
        }
    }
}
