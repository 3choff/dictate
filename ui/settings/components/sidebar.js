/**
 * Sidebar navigation component
 */
export class Sidebar {
    constructor(items, onItemClick) {
        this.items = items; // Array of {id, label, icon}
        this.activeItem = items[0]?.id || null;
        this.onItemClick = onItemClick;
    }

    render() {
        const sidebar = document.createElement('div');
        sidebar.className = 'settings-sidebar';
        
        this.items.forEach(item => {
            const navItem = document.createElement('div');
            navItem.className = 'sidebar-item';
            navItem.dataset.section = item.id;
            
            if (item.id === this.activeItem) {
                navItem.classList.add('active');
            }
            
            navItem.innerHTML = item.icon;
            
            navItem.addEventListener('click', () => this.setActive(item.id));
            
            sidebar.appendChild(navItem);
        });
        
        return sidebar;
    }

    setActive(itemId) {
        this.activeItem = itemId;
        
        // Update active class
        document.querySelectorAll('.sidebar-item').forEach(el => {
            el.classList.toggle('active', el.dataset.section === itemId);
        });
        
        // Notify parent
        if (this.onItemClick) {
            this.onItemClick(itemId);
        }
    }
}
