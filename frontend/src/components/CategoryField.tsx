import { useState, type KeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Plus, RefreshCw } from 'lucide-react';
import { api, ApiError, type Category } from '../api';
import CategoryPicker from './CategoryPicker';

export default function CategoryField({ value, custom, error, disabled, onChange, onCustomChange, onPendingChange }: {
  value: string; custom: boolean; error?: string; disabled: boolean;
  onChange: (value: string) => void; onCustomChange: (custom: boolean) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const categories = useQuery({
    queryKey: ['categories'], queryFn: ({ signal }) => api.categories(signal), staleTime: 0,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const choices = categories.data || [];
  const normalized = value.trim().replace(/\s+/g, ' ');
  const canCreate = normalized.length > 0 && normalized.length <= 100;

  async function create() {
    if (saving || disabled || !canCreate) return;
    setSaveError(''); setSaving(true); onPendingChange(true);
    try {
      await queryClient.cancelQueries({ queryKey: ['categories'] });
      const category = await api.createCategory(normalized);
      queryClient.setQueryData<Category[]>(['categories'], current =>
        [...(current || []).filter(item => item.id !== category.id), category]
          .sort((a, b) => a.name.localeCompare(b.name)));
      onChange(category.name);
      onCustomChange(false);
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (caught) {
      const detail = caught instanceof ApiError ? caught.details.find(item => item.field === 'name') : undefined;
      setSaveError(detail?.message || (caught instanceof Error ? caught.message : 'Unable to save category.'));
    } finally { setSaving(false); onPendingChange(false); }
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') { event.preventDefault(); void create(); }
  }

  return <div className="field category-field">
    <label htmlFor="category-select">Category <small>Optional</small></label>
    <CategoryPicker choices={choices} value={value} custom={custom}
      disabled={disabled || saving || (categories.isPending && !choices.length)}
      loading={categories.isFetching} invalid={!!error}
      describedBy={error ? 'category-error' : 'category-help'}
      onSelect={category => {
        setSaveError('');
        if (category === 'custom') {
          onCustomChange(true); onChange('');
          requestAnimationFrame(() => document.getElementById('category')?.focus());
        } else {
          onCustomChange(false); onChange(category?.name || '');
        }
      }} />
    {categories.isError
      ? <div className="category-status category-load-error" id="category-help" role="alert">
          <span>Couldn’t load categories.</span>
          <button type="button" className="category-retry" onClick={() => void categories.refetch()}
            disabled={disabled || saving || categories.isFetching}><RefreshCw size={13} />Retry</button>
        </div>
      : <span className="field-hint" id="category-help">
          {categories.isFetching ? 'Updating shared categories…' : 'Shared across all products.'}
        </span>}
    {custom && <div className="category-create">
      <label htmlFor="category">New category name</label>
      <div className="category-create-row">
        <input id="category" name="category" value={value} maxLength={100}
          disabled={disabled || saving} aria-invalid={!!error || !!saveError}
          aria-describedby={error ? 'category-error' : saveError ? 'category-save-error' : 'category-create-help'}
          placeholder="e.g. Smartphone" onKeyDown={keyDown}
          onChange={event => { setSaveError(''); onChange(event.target.value); }} />
        <button type="button" className="button secondary category-save"
          disabled={disabled || saving || !canCreate} onClick={() => void create()}>
          {saving ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
          {saving ? 'Saving…' : 'Save category'}
        </button>
      </div>
      <span className="field-hint" id="category-create-help">Save it now, or it will be created when you save this product.</span>
      {saveError && <span className="field-error" id="category-save-error" role="alert">{saveError}</span>}
    </div>}
    {error && <span className="field-error" id="category-error">{error}</span>}
  </div>;
}
