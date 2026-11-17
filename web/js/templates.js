let styles = [];
let stylesLoaded = false;
let activeMenu = null;

async function loadStyles() {
    if (stylesLoaded) return styles;
    const response = await fetch('/autocomplete-plus/styles', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load styles: ${response.status}`);
    styles = (await response.json()).styles || [];
    stylesLoaded = true;
    return styles;
}

function insertText(textarea, value) {
    if (!value) return;
    const separator = textarea.value && !/[\s,]$/.test(textarea.value) ? ', ' : '';
    const text = separator + value;
    textarea.focus();
    textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function closeMenu() {
    activeMenu?.remove();
    activeMenu = null;
}

function makeButton(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
}

function openEditor() {
    closeMenu();
    const overlay = document.createElement('div');
    overlay.className = 'autocomplete-plus-style-editor';
    const dialog = document.createElement('div');
    dialog.className = 'autocomplete-plus-style-editor-dialog';
    const title = document.createElement('h3');
    title.textContent = 'Prompt Styles';
    const list = document.createElement('select');
    list.className = 'autocomplete-plus-style-list';
    let editingIndex = -1;
    const name = document.createElement('input');
    name.placeholder = 'Style name';
    const prompt = document.createElement('textarea');
    prompt.placeholder = 'Positive prompt';
    const negativePrompt = document.createElement('textarea');
    negativePrompt.placeholder = 'Negative prompt';
    const form = document.createElement('div');
    form.className = 'autocomplete-plus-style-form';
    form.append(name, prompt, negativePrompt);
    const refreshList = () => {
        list.replaceChildren();
        styles.forEach((style, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = style.name;
            list.append(option);
        });
    };
    const loadSelected = () => {
        editingIndex = Number(list.value);
        const style = styles[editingIndex];
        name.value = style?.name || '';
        prompt.value = style?.prompt || '';
        negativePrompt.value = style?.negative_prompt || '';
    };
    const save = async () => {
        const style = { name: name.value.trim(), prompt: prompt.value, negative_prompt: negativePrompt.value };
        if (!style.name) return;
        const index = editingIndex;
        if (Number.isInteger(index) && styles[index]) styles[index] = style;
        else styles.push(style);
        await persistStyles();
        refreshList();
        editingIndex = styles.length - 1;
        list.value = String(editingIndex);
        loadSelected();
    };
    const add = () => {
        name.value = '';
        prompt.value = '';
        negativePrompt.value = '';
        editingIndex = -1;
    };
    const remove = async () => {
        const index = editingIndex;
        if (!Number.isInteger(index) || !styles[index]) return;
        styles.splice(index, 1);
        await persistStyles();
        refreshList();
        if (styles.length) loadSelected(); else add();
    };
    refreshList();
    list.addEventListener('change', loadSelected);
    const actions = document.createElement('div');
    actions.className = 'autocomplete-plus-style-editor-actions';
    actions.append(makeButton('New', add), makeButton('Save', save), makeButton('Delete', remove), makeButton('Close', () => overlay.remove()));
    dialog.append(title, list, form, actions);
    overlay.append(dialog);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); });
    document.body.append(overlay);
    if (styles.length) loadSelected();
}

async function persistStyles() {
    const response = await fetch('/autocomplete-plus/styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styles }),
    });
    if (!response.ok) throw new Error(`Failed to save styles: ${response.status}`);
}

function openMenu(textarea, button) {
    if (activeMenu) {
        closeMenu();
        return;
    }

    const menu = document.createElement('div');
    menu.className = 'autocomplete-plus-template-menu';
    const select = document.createElement('select');
    select.className = 'autocomplete-plus-template-select';
    for (const style of styles) {
        const option = document.createElement('option');
        option.value = String(styles.indexOf(style));
        option.textContent = style.name;
        select.append(option);
    }

    const actions = document.createElement('div');
    actions.className = 'autocomplete-plus-template-actions';
    for (const [label, key] of [['Positive', 'prompt'], ['Negative', 'negative_prompt']]) {
        const action = document.createElement('button');
        action.type = 'button';
        action.textContent = label;
        action.addEventListener('click', () => {
            const style = styles[Number(select.value)];
            if (!style) return;
            insertText(textarea, style[key]);
            closeMenu();
        });
        actions.append(action);
    }
    actions.append(makeButton('Manage', openEditor));
    menu.append(select, actions);
    document.body.append(menu);
    const rect = button.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;
    activeMenu = menu;
}

export function attachTemplateButton(textarea) {
    if (textarea.dataset.autocompletePlusTemplates) return;
    textarea.dataset.autocompletePlusTemplates = 'true';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'autocomplete-plus-template-button';
    button.textContent = 'Styles';
    button.title = 'Insert a prompt style from styles.csv';
    button.style.position = 'fixed';
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', async () => {
        try {
            await loadStyles();
            openMenu(textarea, button);
        } catch (error) {
            console.error('[Autocomplete-Plus] Failed to load styles:', error);
        }
    });

    const updatePosition = () => {
        const rect = textarea.getBoundingClientRect();
        button.style.left = `${Math.max(4, rect.right - 68)}px`;
        button.style.top = `${rect.top + 6}px`;
    };
    document.body.append(button);
    updatePosition();
    textarea.addEventListener('focus', updatePosition);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
}

document.addEventListener('click', (event) => {
    if (activeMenu && !activeMenu.contains(event.target) && !event.target.classList.contains('autocomplete-plus-template-button')) {
        closeMenu();
    }
});
