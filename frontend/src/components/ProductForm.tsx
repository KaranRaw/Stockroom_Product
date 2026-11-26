import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ImagePlus, Link2, LoaderCircle, Save, Trash2 } from 'lucide-react';
import { ApiError, type Product, type ProductInput, type ProductPatch } from '../api';
import { changedFields, toInput, validImageUrl, validate, type FormErrors, type FormValues } from '../validation';
import Dialog from './Dialog';
import CategoryField from './CategoryField';
import { useQueryClient } from '@tanstack/react-query';
import ProductImage from './ProductImage';



export default function ProductForm({ product, onClose, onSave }: {
  product?: Product; onClose: () => void;
  onSave: (data: ProductInput | ProductPatch) => Promise<void>;
}) {
  const initial: FormValues = {
    name: product?.name || '', description: product?.description || '', price: product?.price || '',
    quantity: product ? String(product.quantity) : '', category: product?.category || '', image_url: product?.image_url || '',
  };
  const [values, setValues] = useState<FormValues>(initial);
  const [customCategory, setCustomCategory] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = product ? Object.keys(changedFields(toInput(initial), toInput(values))).length > 0 || Object.keys(validate(values)).length > 0 : true;
  const field = (key: keyof FormValues) => ({
    id: key, name: key, value: values[key], 'aria-invalid': Boolean(errors[key]),
    'aria-describedby': errors[key] ? key + '-error' : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues(previous => ({ ...previous, [key]: event.target.value }));
      setErrors(previous => ({ ...previous, [key]: undefined }));
    },
  });
  const fieldError = (key: keyof FormValues) => errors[key] &&
    <span className="field-error" id={key + '-error'}>{errors[key]}</span>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || categoryBusy || !dirty) return;
    const nextErrors = validate(values);
    if (customCategory && !values.category.trim()) nextErrors.category = 'Enter a category name or choose No category.';
    setErrors(nextErrors); setError('');
    if (Object.keys(nextErrors).length) {
      (document.getElementById(Object.keys(nextErrors)[0]) || document.getElementById(Object.keys(nextErrors)[0] + '-select'))?.focus();
      return;
    }
    setBusy(true);
    try {
      const input = toInput(values);
      await onSave(product ? changedFields(toInput(initial), input) : input);
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (caught) {
      // Keep values untouched on validation, network, or server failures.
      setError(caught instanceof Error ? caught.message : 'Unable to save product.');
      if (caught instanceof ApiError) {
        const next: FormErrors = {};
        for (const detail of caught.details) {
          if (detail.field in values) next[detail.field as keyof FormValues] = detail.message;
        }
        setErrors(next);
        const first = caught.details.find(detail => detail.field in values);
        if (first) requestAnimationFrame(() => (document.getElementById(first.field) || document.getElementById(first.field + '-select'))?.focus());
      }
      setBusy(false);
    }
  }

  return <Dialog wide title={product ? 'Edit product' : 'Add a product'}
    subtitle={product ? 'Only changed fields will be updated.' : 'Add the essentials. You can edit everything later.'}
    busy={busy || categoryBusy} onClose={onClose}>
    <form onSubmit={submit} noValidate>
      <fieldset disabled={busy} className="form-body form-fields">
        {error && <div role="alert" className="error-banner">{error}</div>}
        <div className="form-section-label">PRODUCT DETAILS <span>Required fields *</span></div>
        <div className="field"><label htmlFor="name">Product name <span>*</span></label>
          <input {...field('name')} autoFocus required maxLength={200} placeholder="e.g. Studio wireless headphones" />{fieldError('name')}</div>
        <div className="field"><label htmlFor="description">Description <small>Optional</small></label>
          <textarea {...field('description')} rows={3} maxLength={5000} placeholder="Materials, features, or anything worth knowing." />{fieldError('description')}</div>
        <div className="form-grid">
          <div className="field"><label htmlFor="price">Price (INR) <span>*</span></label>
            <input {...field('price')} inputMode="decimal" required placeholder="0.00" />{fieldError('price')}</div>
          <div className="field"><label htmlFor="quantity">Quantity <span>*</span></label>
            <input {...field('quantity')} inputMode="numeric" required placeholder="0" />{fieldError('quantity')}</div>
        </div>
        <CategoryField value={values.category} custom={customCategory} error={errors.category}
          disabled={busy} onCustomChange={setCustomCategory} onPendingChange={setCategoryBusy}
          onChange={category => {
            setValues(previous => ({ ...previous, category }));
            setErrors(previous => ({ ...previous, category: undefined }));
          }} />
        <div className="form-section-label image-section-label"><span><ImagePlus size={15} />PRODUCT IMAGE</span><small>Optional</small></div>
        <div className="image-editor">
          <ProductImage url={validImageUrl(values.image_url.trim()) ? values.image_url.trim() : null} name={values.name || 'Product preview'} />
          <div className="field image-url-field"><label htmlFor="image_url"><Link2 size={14} />Image URL</label>
            <input {...field('image_url')} type="url" maxLength={2048} placeholder="https://your-bucket.s3.amazonaws.com/product.jpg" />
            {fieldError('image_url')}<span className="field-hint">Use a public HTTPS image link. S3 and CDN links work.</span></div>
          {values.image_url && <button type="button" className="icon-button danger-hover remove-image" aria-label="Remove image URL"
            onClick={() => { setValues(previous => ({ ...previous, image_url: '' })); setErrors(previous => ({ ...previous, image_url: undefined })); }}><Trash2 size={17} /></button>}
        </div>
      </fieldset>
      <div className="dialog-footer"><span className="save-note">{product ? dirty ? 'Unsaved changes' : 'No changes yet' : 'Ready when you are'}</span>
        <button type="button" className="button secondary" onClick={onClose} disabled={busy || categoryBusy}>Cancel</button>
        <button type="submit" className="button primary" disabled={busy || categoryBusy || !dirty}>{busy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}
          {busy ? 'Saving…' : product ? 'Save changes' : 'Create product'}</button></div>
    </form>
  </Dialog>;
}
