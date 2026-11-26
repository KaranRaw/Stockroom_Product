import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownWideNarrow, Box, Boxes, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Eye, Layers3, LoaderCircle, Package, Pencil, Plus, RefreshCw, Search, Trash2, TriangleAlert, Wallet, X } from 'lucide-react';
import { api, type Product, type ProductInput, type ProductPatch, type ProductPage, type Stats } from './api';
import Dialog from './components/Dialog';
import { removeFromPage, removeFromStats } from './cache';
import { formatMoney as money } from './format';
import ProductForm from './components/ProductForm';
import ProductImage from './components/ProductImage';


const date = (value: string) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const stock = (quantity: number) => quantity === 0 ? 'Out of stock' : quantity <= 5 ? 'Low stock' : 'In stock';
type Selected = { id: number; mode: 'view' | 'edit' } | null;

function TableSkeleton() {
  return <div className="table-skeleton" role="status" aria-label="Loading products">
    {Array.from({ length: 6 }, (_, index) => <div className="skeleton-row" key={index}>
      <span className="skeleton skeleton-image" /><span className="skeleton skeleton-name" />
      <span className="skeleton skeleton-short" /><span className="skeleton skeleton-short" />
    </div>)}<span className="sr-only">Loading your products</span>
  </div>;
}

export default function App() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Selected>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [guide, setGuide] = useState(false);
  const [toast, setToast] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Query state changes only after typing pauses; intermediate keystrokes never fetch.
  useEffect(() => {
    const timeout = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timeout);
  }, [toast]);
  const products = useQuery({ queryKey: ['products', search, page, pageSize], queryFn: ({ signal }) => api.list(search, page, pageSize, signal) });
  const stats = useQuery({ queryKey: ['stats'], queryFn: ({ signal }) => api.stats(signal) });
  const detail = useQuery({ queryKey: ['product', selected?.id], queryFn: ({ signal }) => api.get(selected!.id, signal), enabled: !!selected, staleTime: 0, gcTime: 0 });
  const total = products.data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (products.data && page > pages) setPage(pages); }, [products.data, pages, page]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['products'] });
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
  }
  async function save(data: ProductInput | ProductPatch) {
    if (selected?.mode === 'edit') {
      const updated = await api.patch(selected.id, data);
      queryClient.setQueryData(['product', selected.id], updated);
      setToast('Product updated.');
    } else {
      await api.create(data as ProductInput);
      setSearchInput(''); setSearch(''); setPage(1);
      setToast('Product added to your catalog.');
    }
    setAdding(false); setSelected(null); refresh();
  }
  async function remove() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true); setDeleteError('');
    try {
      const removed = deleting;
      // Stop pre-delete reads before issuing the mutation; no stale response can overwrite it.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['products'] }),
        queryClient.cancelQueries({ queryKey: ['stats'] }),
      ]);
      const listsBeforeDelete = new Map(
        queryClient.getQueriesData<ProductPage>({ queryKey: ['products'] })
          .map(([key, data]) => [JSON.stringify(key), data] as const),
      );
      const statsBeforeDelete = queryClient.getQueryData<Stats>(['stats']);
      await api.remove(removed.id);
      for (const [key, cached] of queryClient.getQueriesData<ProductPage>({ queryKey: ['products'] })) {
        if (cached) queryClient.setQueryData(key, removeFromPage(cached, removed, String(key[1] || ''),
          cached === listsBeforeDelete.get(JSON.stringify(key))));
      }
      queryClient.setQueryData<Stats>(['stats'], cached =>
        cached && cached === statsBeforeDelete ? removeFromStats(cached, removed) : cached);
      queryClient.removeQueries({ queryKey: ['product', deleting.id] });
      setDeleting(null); setToast('Product removed from the catalog.'); refresh();
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : 'Unable to delete product.');
    } finally { setDeleteBusy(false); }
  }

  return <div className={'app-shell' + (sidebarCollapsed ? ' sidebar-collapsed' : '')}>
    <aside className="sidebar" id="primary-sidebar">
      <div className="sidebar-header">
        <a className="brand" href="/" aria-label="Stockroom home"><span className="brand-mark"><Box size={23} strokeWidth={1.8} /></span><span>Stockroom<span className="brand-period">.</span></span></a>
        <button className="sidebar-toggle" type="button" onClick={() => setSidebarCollapsed(value => !value)} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebarCollapsed} aria-controls="primary-sidebar" title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{sidebarCollapsed ? <ChevronRight size={17} aria-hidden="true" /> : <ChevronLeft size={17} aria-hidden="true" />}</button>
      </div>
      <div className="workspace"><span className="workspace-avatar">S</span><div>Stockroom workspace<small>Inventory management</small></div></div>
      <button className="sidebar-add" type="button" onClick={() => { setSelected(null); setAdding(true); }} aria-label="Add product" title={sidebarCollapsed ? 'Add product' : undefined}><Plus size={17} aria-hidden="true" /><span>Add product</span></button>
      <div className="nav-label">CATALOG</div>
      <nav aria-label="Main navigation"><a className="nav-item active" href="/" aria-label="Products" aria-current="page"><Boxes size={18} /><span>Products</span></a></nav>
      <div className="sidebar-bottom">
        <button className="help-link" onClick={() => setGuide(true)} aria-label="Open workspace guide" title={sidebarCollapsed ? 'Workspace guide' : undefined}><CircleHelp size={17} /><span>Workspace guide</span></button>
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>Products</strong></div><span className="edition-tag"><Layers3 size={14} />Product management</span></header>
      <main>
        <div className="page-heading"><div><div className="eyebrow">INVENTORY / CATALOG</div><h1>Products</h1></div>
          <button className="button primary" onClick={() => { setSelected(null); setAdding(true); }}><Plus size={18} />Add product</button></div>

        <section className="stats-grid" aria-label="Inventory overview">
          {[{ label: 'Total products', value: stats.data?.products.toLocaleString('en-IN'), icon: Boxes, note: 'Distinct items in your catalog' },
            { label: 'Units in stock', value: stats.data?.units.toLocaleString('en-IN'), icon: Layers3, note: 'Available across all products' },
            { label: 'Inventory value', value: stats.data ? money(stats.data.value) : undefined, icon: Wallet, note: 'Unit price × quantity · INR' },
            { label: 'Low stock', value: stats.data?.low_stock.toLocaleString('en-IN'), icon: TriangleAlert, note: '5 units or fewer, including zero' },
          ].map(({ label, value, icon: Icon, note }, index) => <article className={'stat-card' + (index === 3 ? ' stock-attention' : '')} key={label}>
            <div className="stat-top"><span>{label}</span><Icon size={17} /></div>
            <strong className="stat-value">{value ?? (stats.isPending ? <span className="skeleton metric-skeleton" /> : '—')}</strong>
            <span className="stat-note">{stats.isError ? 'Overview unavailable' : note}</span>
          </article>)}
        </section>

        <section className="catalog" aria-labelledby="catalog-title" aria-busy={products.isFetching}>
          <div className="catalog-heading"><div className="catalog-tab"><span className="tab-indicator" /><h2 id="catalog-title">All products</h2><span className="count-pill">{products.data ? total : '—'}</span></div><span className="catalog-description">{search ? 'Filtered by product name' : 'Your complete product catalog'}</span></div>
          <div className="table-toolbar"><div className="search-field"><Search size={18} /><input aria-label="Search products by name" placeholder="Search by product name…" value={searchInput} maxLength={200} onChange={event => setSearchInput(event.target.value)} />
            {searchInput && <button className="clear-search" aria-label="Clear search" onClick={() => setSearchInput('')}><X size={15} /></button>}
            {products.isFetching && !products.isPending && <LoaderCircle size={15} className="spin" aria-label="Updating results" />}</div>
            <div className="toolbar-actions"><span className="sort-note"><ArrowDownWideNarrow size={16} />Newest first</span><button className="button secondary refresh-button" onClick={refresh} disabled={products.isFetching} aria-label="Refresh products"><RefreshCw size={16} className={products.isFetching ? 'spin' : ''} /><span>Refresh</span></button></div>
          </div>

          {products.isPending ? <TableSkeleton />
            : products.isError ? <div className="state-panel"><span className="state-icon error-icon"><TriangleAlert size={26} /></span><h3>We couldn’t load your products</h3><p role="alert">{products.error.message}</p><button className="button secondary" onClick={refresh}><RefreshCw size={15} />Try again</button></div>
            : !products.data.items.length ? <div className="state-panel"><span className="state-icon"><Package size={29} /></span><h3>{search ? 'No matching products' : 'Your catalog starts here'}</h3><p>{search ? 'Try another name, or clear your search to see everything.' : 'Add your first product to bring your inventory into focus.'}</p>
              <button className="button secondary" onClick={() => search ? setSearchInput('') : setAdding(true)}>{search ? 'Clear search' : 'Add your first product'}</button></div>
            : <div className="table-scroll"><table><thead><tr><th scope="col">Product</th><th scope="col">Category</th><th scope="col" className="numeric">Unit price</th><th scope="col">Availability</th><th scope="col">Created</th><th scope="col" className="actions-heading">Actions</th></tr></thead>
              <tbody>{products.data.items.map(product => <tr key={product.id}>
                <td><div className="product-cell"><ProductImage url={product.image_url} name={product.name} /><div className="product-text"><button className="product-name" onClick={() => setSelected({ id: product.id, mode: 'view' })}>{product.name}</button><span className="product-id">PRD-{String(product.id).padStart(4, '0')}</span></div></div></td>
                <td data-label="Category"><span className="category-tag">{product.category || 'Uncategorized'}</span></td>
                <td data-label="Unit price" className="numeric price-cell">{money(product.price)}</td>
                <td data-label="Availability"><div className="stock-cell"><span className={'stock-badge ' + (product.quantity === 0 ? 'out' : product.quantity <= 5 ? 'low' : 'available')}>{stock(product.quantity)}</span><small>{product.quantity.toLocaleString('en-IN')} units</small></div></td>
                <td data-label="Created" className="date-cell">{date(product.created_at)}</td>
                <td><div className="row-actions"><button className="icon-button" aria-label={'View ' + product.name} title="View product" onClick={() => setSelected({ id: product.id, mode: 'view' })}><Eye size={17} /></button><button className="icon-button" aria-label={'Edit ' + product.name} title="Edit product" onClick={() => setSelected({ id: product.id, mode: 'edit' })}><Pencil size={16} /></button><button className="icon-button danger-hover" aria-label={'Delete ' + product.name} title="Delete product" onClick={() => { setDeleteError(''); setDeleting(product); }}><Trash2 size={16} /></button></div></td>
              </tr>)}</tbody></table></div>}

          <div className="table-footer"><span>{total ? <>Showing <strong>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</strong> of <strong>{total}</strong> products</> : 'No products to display'}</span>
            <div className="pagination"><div className="page-size"><label htmlFor="page-size">Rows</label><div className="select-wrap"><select id="page-size" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10,25,50].map(size => <option key={size}>{size}</option>)}</select><ChevronDown size={13} /></div></div>
              <span className="page-number">Page <strong>{page}</strong> of {pages}</span><button className="page-button" aria-label="Previous page" onClick={() => setPage(value => value - 1)} disabled={page <= 1 || products.isFetching}><ChevronLeft size={17} /></button><button className="page-button" aria-label="Next page" onClick={() => setPage(value => value + 1)} disabled={page >= pages || products.isFetching}><ChevronRight size={17} /></button></div></div>
        </section>
        <footer className="page-footer"><span>STOCKROOM<span className="footer-separator">/</span>Product management, without the noise.</span><span>All prices in INR</span></footer>
      </main>
    </div>

    {toast && <div className="toast" role="status"><span className="toast-check"><Check size={15} /></span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
    {adding && <ProductForm onClose={() => setAdding(false)} onSave={save} />}
    {selected && (detail.isPending || detail.isError) && <Dialog title="Product details" onClose={() => setSelected(null)}>
      <div className="form-body">{detail.isPending ? <div className="detail-loading" role="status"><span className="skeleton detail-image-skeleton" /><span className="skeleton detail-line-skeleton" /><span className="skeleton detail-line-skeleton" /><span className="sr-only">Loading product</span></div> : <><p role="alert" className="error-banner">{detail.error.message}</p><button className="button secondary" onClick={() => void detail.refetch()}>Try again</button></>}</div></Dialog>}
    {selected && detail.data && !detail.isError && !detail.isPending && (selected.mode === 'edit'
      ? <ProductForm key={detail.data.id} product={detail.data} onClose={() => setSelected(null)} onSave={save} />
      : <Dialog title="Product details" subtitle={'PRD-' + String(detail.data.id).padStart(4, '0')} onClose={() => setSelected(null)}>
        <div className="form-body"><ProductImage url={detail.data.image_url} name={detail.data.name} large />
          <div className="detail-title"><div><h3>{detail.data.name}</h3><span className="category-tag">{detail.data.category || 'Uncategorized'}</span></div></div>
          <div className="detail-grid"><div><span>Unit price</span><strong>{money(detail.data.price)}</strong></div><div><span>Quantity</span><strong>{detail.data.quantity} units</strong></div><div><span>Availability</span><strong>{stock(detail.data.quantity)}</strong></div><div><span>Created date</span><strong>{date(detail.data.created_at)}</strong></div></div>
          <div className="description"><span>Description</span><p>{detail.data.description || 'No description added.'}</p></div></div>
        <div className="dialog-footer"><button className="button secondary" onClick={() => setSelected(null)}>Close</button><button className="button primary" onClick={() => setSelected({ ...selected, mode: 'edit' })}><Pencil size={16} />Edit product</button></div>
      </Dialog>)}
    {deleting && <Dialog title="Delete this product?" subtitle="This hides the product from your catalog. Its record is retained." busy={deleteBusy} onClose={() => setDeleting(null)}>
      <div className="form-body"><div className="delete-summary"><ProductImage url={deleting.image_url} name={deleting.name} /><p><strong>{deleting.name}</strong><span>PRD-{String(deleting.id).padStart(4, '0')} · {deleting.quantity} units</span></p></div><p className="delete-warning">Deleted products are excluded from search and inventory totals.</p>{deleteError && <p role="alert" className="error-banner">{deleteError}</p>}</div>
      <div className="dialog-footer"><button className="button secondary" onClick={() => setDeleting(null)} disabled={deleteBusy}>Keep product</button><button className="button danger" onClick={() => void remove()} disabled={deleteBusy}>{deleteBusy ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}{deleteBusy ? 'Deleting…' : 'Delete product'}</button></div>
    </Dialog>}
    {guide && <Dialog title="A place for every product." subtitle="Stockroom · Workspace guide" onClose={() => setGuide(false)}><div className="form-body guide"><p>Add, search, and update products from one catalog. All prices are in Indian rupees (INR).</p><p>Images use public HTTPS links. Upload files to your S3 bucket or image host, then paste the readable image URL. Expired or inaccessible links show a fallback.</p><p>Low stock means 5 units or fewer. Inventory value is unit price multiplied by quantity, across the whole catalog.</p></div><div className="dialog-footer"><button className="button primary" onClick={() => setGuide(false)}>Got it</button></div></Dialog>}
  </div>;
}
