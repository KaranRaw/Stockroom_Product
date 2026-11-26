import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import type { Category } from '../api';

type Choice = { key: string; label: string; category?: Category };

export default function CategoryPicker({ choices, value, custom, disabled, loading, invalid, describedBy, onSelect }: {
  choices: Category[]; value: string; custom: boolean; disabled: boolean; loading: boolean;
  invalid: boolean; describedBy: string; onSelect: (category: Category | null | 'custom') => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(-1);
  const expanded = open && !disabled;
  const query = search.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const matches = choices.filter(category => category.name.toLocaleLowerCase().includes(query));
  const actions: Choice[] = [{ key: 'none', label: 'No category' }, { key: 'custom', label: 'Custom category…' }];
  const options: Choice[] = [...matches.map(category => ({
    key: 'category:' + category.id, label: category.name, category,
  })), ...actions];
  const label = custom ? 'Custom category…' : value || (loading ? 'Loading categories…' : 'No category');

  function close() { setOpen(false); setSearch(''); setActive(-1); }

  function show() {
    if (disabled) return;
    setSearch('');
    const index = choices.findIndex(category => category.name === value);
    setActive(index >= 0 && !custom ? index : -1);
    setOpen(true);
  }

  function choose(option: Choice) {
    onSelect(option.category || (option.key === 'custom' ? 'custom' : null));
    close();
  }

  useEffect(() => {
    if (!expanded) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false); setSearch(''); setActive(-1);
      }
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [expanded]);

  useEffect(() => {
    // Scroll the result list only; keep the modal header and footer stationary.
    const container = list.current;
    const option = container?.querySelector<HTMLElement>('[data-active="true"]');
    if (!container || !option) return;
    if (option.offsetTop < container.scrollTop) container.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > container.scrollTop + container.clientHeight)
      container.scrollTop = option.offsetTop + option.offsetHeight - container.clientHeight;
  }, [active, search, expanded]);

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault(); event.stopPropagation(); close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!expanded) { show(); return; }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActive(current => current < 0 ? (direction > 0 ? 0 : options.length - 1)
        : (current + direction + options.length) % options.length);
    } else if (expanded && (event.key === 'Home' || event.key === 'End') && !search) {
      event.preventDefault(); setActive(event.key === 'Home' ? 0 : options.length - 1);
    } else if (event.key === 'Enter' && expanded) {
      // Searching never submits the product or creates a category implicitly.
      event.preventDefault();
      if (active >= 0 && options[active]) choose(options[active]);
    }
  }

  function optionButton(option: Choice, index: number) {
    const selected = option.category ? !custom && option.category.name === value
      : option.key === 'custom' ? custom : !custom && !value;
    return <button type="button" role="option" key={option.key}
      id={listId + '-' + index} tabIndex={-1} aria-selected={selected}
      className={'category-choice' + (active === index ? ' active' : '')}
      data-active={active === index} title={option.label}
      onMouseDown={event => event.preventDefault()}
      onMouseMove={() => setActive(index)} onClick={() => choose(option)}>
      {option.key === 'custom' && <Plus size={15} aria-hidden="true" />}
      <span>{option.label}</span>
      {selected && <Check size={16} aria-hidden="true" />}
    </button>;
  }

  return <div ref={root} className="category-picker"
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}>
    <div className="category-picker-control">
      <Search size={16} className="category-search-icon" aria-hidden="true" />
      <input ref={input} id="category-select" role="combobox" autoComplete="off" spellCheck={false}
        value={expanded ? search : label} placeholder="Search categories…"
        disabled={disabled} aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
        aria-autocomplete="list" aria-haspopup="listbox" aria-invalid={invalid}
        aria-describedby={describedBy} aria-busy={loading}
        aria-activedescendant={expanded && options[active] ? listId + '-' + active : undefined}
        onFocus={show} onClick={() => { if (!expanded) show(); }} onKeyDown={keyDown}
        onChange={event => {
          const term = event.target.value;
          setSearch(term); setOpen(true);
          setActive(choices.some(category => category.name.toLocaleLowerCase()
            .includes(term.trim().replace(/\s+/g, ' ').toLocaleLowerCase())) ? 0 : -1);
        }} />
      {expanded && search && <button type="button" className="category-search-clear" tabIndex={-1}
        aria-label="Clear category search" onMouseDown={event => event.preventDefault()}
        onClick={() => { setSearch(''); setActive(-1); input.current?.focus(); }}>
        <X size={14} aria-hidden="true" />
      </button>}
      <button type="button" className="category-picker-toggle" tabIndex={-1} disabled={disabled}
        aria-label={expanded ? 'Close category choices' : 'Open category choices'}
        onMouseDown={event => event.preventDefault()}
        onClick={() => { if (expanded) close(); else { input.current?.focus(); show(); } }}>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
    </div>
    {expanded && <div className="category-picker-panel">
      <div role="listbox" id={listId} aria-label="Category choices">
        <div ref={list} className="category-results" role="presentation">
          {matches.map((_, index) => optionButton(options[index], index))}
          {!matches.length && <div className="category-empty" role="status">
            {query ? 'No matching categories.' : 'No categories yet.'}
          </div>}
        </div>
        <div className="category-picker-actions" role="presentation">
          {actions.map((_, index) => optionButton(options[matches.length + index], matches.length + index))}
        </div>
      </div>
      <span className="category-results-count" role="status">
        {matches.length} {matches.length === 1 ? 'category' : 'categories'}{query ? ' found' : ' available'}
      </span>
    </div>}
  </div>;
}
